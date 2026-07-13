import React, { useMemo, useState, type FormEvent } from "react";
import { useLifeOps } from "./state/LifeOpsContext";
import type {
  AARReview,
  AARType,
  AvoidanceCheckIn,
  Category,
  DailyMission,
  FinancialData,
  Habit,
  LessonLearned,
  OpenLoop,
  OpenLoopStatus,
  PageKey,
  Priority,
  Project,
  ProjectStatus,
  QuickAddKind,
  RepeatSetting,
} from "./types";
import { addDays, formatDate, isThisWeek, todayKey } from "./utils/date";
import {
  exportAarMarkdown,
  exportDataJson,
  exportLessonsMarkdown,
  importDataFromFile,
} from "./utils/exporters";
import {
  isLoopStale,
  isDueSoon,
  isProjectStale,
  needsFollowUp,
  needsNextAction,
  suggestForLoop,
  suggestForProject,
  suggestFromAAR,
} from "./utils/rules";

const pages: { key: PageKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "loops", label: "Open Loops" },
  { key: "projects", label: "Projects" },
  { key: "aars", label: "AAR Reviews" },
  { key: "lessons", label: "Lessons" },
  { key: "finance", label: "Finance" },
  { key: "settings", label: "Settings" },
];

const loopStatuses: OpenLoopStatus[] = [
  "Captured",
  "Next Action",
  "In Progress",
  "Waiting",
  "Scheduled",
  "Done",
  "Dropped",
];
const priorities: Priority[] = ["Low", "Medium", "High"];
const repeatSettings: RepeatSetting[] = ["None", "Daily", "Weekly", "Monthly"];
const projectStatuses: ProjectStatus[] = [
  "Idea",
  "Planning",
  "Building",
  "Revising",
  "Deployed",
  "Paused",
  "Archived",
];
const aarTypes: AARType[] = ["Daily", "Weekly", "Project", "Custom"];

function activeCategory(categories: Category[], id?: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

function textList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function mobileNavLabel(page: PageKey): string {
  return {
    dashboard: "Home",
    loops: "Loops",
    projects: "Projects",
    aars: "Reviews",
    lessons: "Lessons",
    finance: "Money",
    settings: "Settings",
  }[page];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function yearsToTarget(current: number, annualInvestment: number, target: number, returnRate: number): number | null {
  if (current >= target) return 0;
  if (annualInvestment <= 0 && returnRate <= 0) return null;
  let projected = Math.max(0, current);
  for (let year = 1; year <= 80; year += 1) {
    projected = projected * (1 + Math.max(0, returnRate)) + annualInvestment;
    if (projected >= target) return year;
  }
  return null;
}

const investedAccountTypes = ["TSP", "Roth IRA", "Brokerage"];

function accountBalance(finance: FinancialData, accountId: string): number {
  const holdings = finance.holdings.filter((holding) => holding.accountId === accountId);
  if (holdings.length) return holdings.reduce((sum, holding) => sum + holding.value, 0);
  return finance.accounts.find((account) => account.id === accountId)?.balance || 0;
}

function getFinanceSummary(finance: FinancialData) {
  const assumptions = finance.assumptions;
  const assets = finance.accounts
    .filter((account) => account.type !== "Debt")
    .reduce((sum, account) => sum + accountBalance(finance, account.id), 0);
  const debt = finance.accounts
    .filter((account) => account.type === "Debt")
    .reduce((sum, account) => sum + account.balance, 0);
  const netWorth = assets - debt;
  const invested = finance.accounts
    .filter((account) => investedAccountTypes.includes(account.type))
    .reduce((sum, account) => sum + accountBalance(finance, account.id), 0);
  const cash = finance.accounts
    .filter((account) => account.type === "Savings")
    .reduce((sum, account) => sum + account.balance, 0);

  // HFOS v2: FI target = (expenses - pension - Social Security) x 25 when expenses are set.
  const expenses = assumptions.annualEssentialExpenses || 0;
  const coveredByIncome = ((assumptions.pensionMonthly || 0) + (assumptions.socialSecurityMonthly || 0)) * 12;
  const fiTarget = expenses > 0 ? Math.max(0, expenses - coveredByIncome) * 25 : assumptions.targetFiNumber;
  const efTarget = expenses > 0 ? Math.round(expenses / 2) : assumptions.emergencyFundTarget;
  const contributions = finance.accounts
    .filter((account) => investedAccountTypes.includes(account.type))
    .reduce((sum, account) => sum + (account.annualContribution || 0), 0);
  const annualInvestment = contributions > 0 ? contributions : assumptions.annualInvestment;

  const fiProgress =
    fiTarget > 0 ? Math.max(0, Math.min(100, (invested / fiTarget) * 100)) : invested > 0 ? 100 : 0;
  const fiYears = yearsToTarget(invested, annualInvestment, fiTarget, assumptions.expectedAnnualReturn);

  return { assets, debt, netWorth, invested, cash, fiTarget, efTarget, annualInvestment, fiProgress, fiYears };
}

interface DecisionStep {
  label: string;
  state: "done" | "current" | "upcoming";
}

function getNextDollarRecommendation(finance: FinancialData): {
  title: string;
  detail: string;
  steps: DecisionStep[];
} {
  const summary = getFinanceSummary(finance);
  const roth = finance.accounts.find((account) => account.type === "Roth IRA");
  const rothRoom = roth?.annualLimit ? roth.annualLimit - (roth.annualContribution || 0) : 0;

  const brokerage = finance.accounts.find((account) => account.type === "Brokerage");
  const brokerageHoldings = finance.holdings.filter((holding) => holding.accountId === brokerage?.id);
  const brokerageTotal = brokerageHoldings.reduce((sum, holding) => sum + holding.value, 0);
  const schb = brokerageHoldings
    .filter((holding) => holding.category === "SCHB")
    .reduce((sum, holding) => sum + holding.value, 0);
  const stocks = brokerageHoldings
    .filter((holding) => holding.category === "Individual Stocks")
    .reduce((sum, holding) => sum + holding.value, 0);
  const schbPercent = brokerageTotal ? (schb / brokerageTotal) * 100 : 0;
  const stocksPercent = brokerageTotal ? (stocks / brokerageTotal) * 100 : 0;

  let currentStep: number;
  let title: string;
  let detail: string;

  if (finance.assumptions.tspMatchCaptured === false) {
    currentStep = 0;
    title = "Raise TSP to at least 5%";
    detail = "The match is an immediate 100% return. Fix this before anything else.";
  } else if (summary.cash < summary.efTarget) {
    currentStep = 1;
    title = "Build the emergency fund";
    detail = `${formatMoney(summary.efTarget - summary.cash)} remains before extra investing.`;
  } else if (rothRoom > 0) {
    currentStep = 2;
    title = "Send the next dollar to Roth IRA";
    detail = `${formatMoney(rothRoom)} of contribution room remains. Buy SCHB.`;
  } else if (!brokerageTotal || schbPercent < 80) {
    currentStep = 3;
    title = "Buy SCHB in brokerage";
    detail = brokerageTotal
      ? `SCHB is ${formatPercent(schbPercent)} of brokerage; target is 80% before individual stocks.`
      : "Brokerage is the default home for extra dollars. Start with SCHB.";
  } else if (stocksPercent >= 20) {
    currentStep = 3;
    title = "Individual stocks at the 20% cap - buy SCHB";
    detail = `Stocks are ${formatPercent(stocksPercent)} of brokerage. New dollars go to SCHB until back under 20%.`;
  } else {
    currentStep = 3;
    title = "Buy SCHB or an approved stock";
    detail = "Stocks stay under 20% of brokerage and 5% per company at purchase. When in doubt, buy SCHB.";
  }

  const labels = [
    "TSP at 5%+ (full match)",
    "Emergency fund at target",
    "Max Roth IRA",
    "Brokerage: SCHB, then approved stocks",
  ];
  const steps: DecisionStep[] = labels.map((label, index) => ({
    label,
    state: index < currentStep ? "done" : index === currentStep ? "current" : "upcoming",
  }));

  return { title, detail, steps };
}

const hfosMilestones: { amount: number; action: string }[] = [
  { amount: 100000, action: "Stay the course." },
  { amount: 250000, action: "Review allocation. Revisit brokerage-vs-max-TSP decision." },
  { amount: 500000, action: "Review tax and estate planning." },
  { amount: 1000000, action: "Evaluate work optionality." },
  { amount: 2000000, action: "Reassess long-term lifestyle goals." },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-ink-300 p-5 text-sm text-ink-600 dark:border-ink-700 dark:text-ink-300">
      <p className="font-semibold text-ink-900 dark:text-ink-50">{title}</p>
      <p className="mt-1">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-ink-950/60 p-3 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full min-w-0 max-w-full overflow-auto rounded-lg bg-white shadow-soft dark:bg-ink-900 sm:max-w-2xl">
        <div className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-3 border-b border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
          <h2 className="min-w-0 text-lg font-bold">{title}</h2>
          <button className="btn-ghost min-h-10 px-3" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function CategorySelect({
  value,
  onChange,
  categories,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  categories: Category[];
}) {
  return (
    <select
      className="input"
      value={value || ""}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <option value="">No category</option>
      {categories
        .filter((category) => !category.archived)
        .map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
    </select>
  );
}

function Layout({
  page,
  setPage,
  onQuickAdd,
  children,
}: {
  page: PageKey;
  setPage: (page: PageKey) => void;
  onQuickAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip pb-24 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/92 backdrop-blur dark:border-ink-800 dark:bg-ink-950/92">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-700 dark:text-signal-500">
              LifeOps
            </p>
            <h1 className="text-lg font-black sm:text-xl">Command Center</h1>
          </div>
          <button className="btn-primary hidden sm:inline-flex" onClick={onQuickAdd}>
            Quick Add
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl min-w-0 gap-5 px-3 py-5 sm:px-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="no-print hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {pages.map((item) => (
              <button
                key={item.key}
                className={`w-full rounded-md px-3 py-3 text-left text-sm font-semibold ${
                  page === item.key
                    ? "bg-ink-900 text-white dark:bg-white dark:text-ink-950"
                    : "text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"
                }`}
                onClick={() => setPage(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 max-w-full">{children}</main>
      </div>

      <button
        className="no-print fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-signal-600 text-xl font-black text-white shadow-soft sm:hidden"
        onClick={onQuickAdd}
        aria-label="Quick Add"
      >
        +
      </button>

      <nav className="no-print fixed bottom-0 left-0 right-0 z-30 grid min-w-0 grid-cols-7 border-t border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950 lg:hidden">
        {pages.map((item) => (
          <button
            key={item.key}
            className={`min-h-16 min-w-0 px-0.5 text-[10px] font-semibold leading-tight min-[360px]:text-[11px] ${
              page === item.key
                ? "text-signal-700 dark:text-signal-500"
                : "text-ink-500 dark:text-ink-400"
            }`}
            onClick={() => setPage(item.key)}
          >
            {mobileNavLabel(item.key)}
          </button>
        ))}
      </nav>
    </div>
  );
}

function MissionForm({
  mission,
  suggestions,
  onSave,
}: {
  mission?: DailyMission;
  suggestions: OpenLoop[];
  onSave: (mission: Partial<DailyMission>) => void;
}) {
  const [focus, setFocus] = useState(mission?.focus || "");
  const [topThree, setTopThree] = useState((mission?.topThree || []).join("\n"));
  const [nonNegotiable, setNonNegotiable] = useState(mission?.nonNegotiable || "");
  const [avoid, setAvoid] = useState(mission?.avoid || "");

  function toggleSuggestion(loop: OpenLoop) {
    const current = textList(topThree);
    if (current.includes(loop.title)) {
      setTopThree(current.filter((item) => item !== loop.title).join("\n"));
      return;
    }
    if (current.length < 3) setTopThree([...current, loop.title].join("\n"));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          id: mission?.id,
          date: todayKey(),
          focus,
          topThree: textList(topThree),
          nonNegotiable,
          avoid,
        });
      }}
    >
      <Field label="Today's focus">
        <input
          className="input"
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="What is the main shape of today?"
        />
      </Field>
      <Field label="Top 3 priorities">
        <textarea
          className="input min-h-28"
          value={topThree}
          onChange={(event) => setTopThree(event.target.value)}
          placeholder="One priority per line"
        />
      </Field>
      {suggestions.length ? (
        <div className="min-w-0">
          <p className="label">Suggested from open loops</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((loop) => (
              <button
                type="button"
                key={loop.id}
                className="badge hover:bg-ink-100 dark:hover:bg-ink-800"
                onClick={() => toggleSuggestion(loop)}
              >
                {loop.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="One non-negotiable">
          <input
            className="input"
            value={nonNegotiable}
            onChange={(event) => setNonNegotiable(event.target.value)}
            placeholder="Small, concrete, doable"
          />
        </Field>
        <Field label="One thing to avoid">
          <input
            className="input"
            value={avoid}
            onChange={(event) => setAvoid(event.target.value)}
            placeholder="The trap to watch"
          />
        </Field>
      </div>
      <button className="btn-primary w-full sm:w-auto" type="submit">
        Save Mission
      </button>
    </form>
  );
}

function Dashboard({
  setPage,
}: {
  setPage: (page: PageKey) => void;
}) {
  const {
    data,
    upsertMission,
    updateHabit,
    addAAR,
    addAvoidance,
    addOpenLoop,
    addLesson,
  } = useLifeOps();
  const [missionOpen, setMissionOpen] = useState(false);
  const [minimumOpen, setMinimumOpen] = useState(false);
  const [avoidOpen, setAvoidOpen] = useState(false);
  const today = todayKey();
  const mission = data.missions.find((item) => item.date === today);
  const activeLoops = data.openLoops.filter(
    (loop) => !loop.archivedAt && !["Done", "Dropped"].includes(loop.status),
  );
  const suggestedLoops = activeLoops
    .filter(
      (loop) =>
        loop.priority === "High" ||
        isDueSoon(loop) ||
        needsNextAction(loop) ||
        isLoopStale(loop, data.settings.staleTaskDays) ||
        needsFollowUp(loop),
    )
    .slice(0, 8);
  const activeProjects = data.projects.filter((project) => project.status !== "Archived");
  const activeLesson = data.lessons.find((lesson) => lesson.status === "Active");
  const habits = data.habits.filter((habit) => habit.active);
  const financeSummary = getFinanceSummary(data.finance);
  const financeRecommendation = getNextDollarRecommendation(data.finance);

  function endDayAAR() {
    addAAR({
      title: `Daily AAR - ${formatDate(today)}`,
      type: "Daily",
      intendedOutcome: mission?.focus,
      nextAction: mission?.topThree[0],
      tags: ["daily"],
    });
    setPage("aars");
  }

  return (
    <div className="space-y-5">
      <section className="card border-signal-500/40 bg-signal-50/60 dark:bg-signal-500/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-signal-700 dark:text-signal-500">
              {formatDate(today)}
            </p>
            <h2 className="text-2xl font-black">Today's Mission</h2>
            <p className="mt-2 text-ink-700 dark:text-ink-200">
              {mission?.focus || "Start with a focused, lightweight plan."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setMissionOpen(true)}>
              Start Today
            </button>
            <button className="btn-secondary" onClick={() => setMissionOpen(true)}>
              Edit Today
            </button>
            <button className="btn-secondary" onClick={endDayAAR}>
              End-of-Day AAR
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div>
            <p className="label">Top 3</p>
            {mission?.topThree.length ? (
              <ol className="space-y-2">
                {mission.topThree.map((item, index) => (
                  <li key={item} className="rounded-md bg-white/80 p-3 dark:bg-ink-900">
                    {index + 1}. {item}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-600 dark:text-ink-300">No priorities chosen yet.</p>
            )}
          </div>
          <div className="rounded-md bg-white/80 p-3 dark:bg-ink-900">
            <p className="label">Non-negotiable</p>
            <p>{mission?.nonNegotiable || "Choose one small anchor."}</p>
          </div>
          <div className="rounded-md bg-white/80 p-3 dark:bg-ink-900">
            <p className="label">Avoid</p>
            <p>{mission?.avoid || "Name the main drift risk."}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="card">
          <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="min-w-0 text-xl font-bold">Open Loops Snapshot</h2>
            <button className="btn-secondary" onClick={() => setPage("loops")}>
              Full Page
            </button>
          </div>
          <div className="space-y-3">
            {activeLoops.slice(0, 5).map((loop) => (
              <LoopRow key={loop.id} loop={loop} compact />
            ))}
            {!activeLoops.length ? (
              <EmptyState title="No open loops" text="Capture what is taking up mental space." />
            ) : null}
          </div>
        </section>

        <section className="card">
          <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="min-w-0 text-xl font-bold">Projects Snapshot</h2>
            <button className="btn-secondary" onClick={() => setPage("projects")}>
              Projects
            </button>
          </div>
          <div className="space-y-3">
            {activeProjects.slice(0, 4).map((project) => (
              <ProjectCard key={project.id} project={project} compact />
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <section className="card">
          <h2 className="text-xl font-bold">Minimum Viable Day</h2>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
            A reduced version of the day when full strength is not available.
          </p>
          <button className="btn-primary mt-4 w-full" onClick={() => setMinimumOpen(true)}>
            Give Me the Minimum
          </button>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold">What Am I Avoiding?</h2>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
            Convert avoidance into one visible two-minute action.
          </p>
          <button className="btn-secondary mt-4 w-full" onClick={() => setAvoidOpen(true)}>
            Quick Check-In
          </button>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold">Financial Command</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-ink-50 p-3 dark:bg-ink-950">
              <p className="label">Net Worth</p>
              <p className="font-bold">{formatMoney(financeSummary.netWorth)}</p>
            </div>
            <div className="rounded-md bg-ink-50 p-3 dark:bg-ink-950">
              <p className="label">FI</p>
              <p className="font-bold">{formatPercent(financeSummary.fiProgress)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
            {financeRecommendation.title}
          </p>
          <button className="btn-primary mt-4 w-full" onClick={() => setPage("finance")}>
            Open Money
          </button>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold">Recent Lesson</h2>
          {activeLesson ? (
            <div className="mt-3 space-y-3">
              <p className="font-semibold">{activeLesson.lesson}</p>
              <p className="text-sm text-ink-600 dark:text-ink-300">
                Apply today: {activeLesson.actionToApply || "Keep it visible while choosing next actions."}
              </p>
            </div>
          ) : (
            <EmptyState title="No active lessons" text="Save one from an AAR or add it manually." />
          )}
        </section>
      </div>

      <section className="card">
        <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="min-w-0 text-xl font-bold">Minimal Habit Check-In</h2>
          <span className="badge">Supportive, not streak-based</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {habits.map((habit) => {
            const checked = habit.completedDates.includes(today);
            const completedThisWeek = habit.completedDates.filter(isThisWeek).length;
            return (
              <label key={habit.id} className="panel flex min-h-24 items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-signal-600"
                  checked={checked}
                  onChange={(event) => {
                    updateHabit(habit.id, {
                      completedDates: event.target.checked
                        ? Array.from(new Set([...habit.completedDates, today]))
                        : habit.completedDates.filter((date) => date !== today),
                    });
                  }}
                />
                <span>
                  <span className="block font-semibold">{habit.name}</span>
                  <span className="mt-1 block text-sm text-ink-600 dark:text-ink-300">
                    Completed this week: {completedThisWeek}
                    {habit.targetPerWeek ? ` / target ${habit.targetPerWeek}` : ""}
                  </span>
                  {habit.minimumVersion ? (
                    <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">
                      Minimum: {habit.minimumVersion}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {missionOpen ? (
        <Modal title="Start Today" onClose={() => setMissionOpen(false)}>
          <MissionForm
            mission={mission}
            suggestions={suggestedLoops}
            onSave={(next) => {
              upsertMission(next);
              setMissionOpen(false);
            }}
          />
        </Modal>
      ) : null}

      {minimumOpen ? (
        <Modal title="Minimum Viable Day" onClose={() => setMinimumOpen(false)}>
          <div className="space-y-3">
            {data.settings.minimumDayDefaults.map((action) => (
              <label key={action} className="panel flex items-center gap-3 p-3">
                <input type="checkbox" className="h-5 w-5 accent-signal-600" />
                <span>{action}</span>
              </label>
            ))}
          </div>
        </Modal>
      ) : null}

      {avoidOpen ? (
        <AvoidanceModal
          onClose={() => setAvoidOpen(false)}
          onSave={(checkIn) => {
            const saved = addAvoidance(checkIn);
            if (saved.twoMinuteAction) {
              addOpenLoop({
                title: saved.twoMinuteAction,
                categoryId: saved.categoryId,
                status: "Next Action",
                priority: "Medium",
                notes: `Created from avoidance check-in: ${saved.avoidedThing}`,
              });
            }
            if (saved.reason) {
              addLesson({
                lesson: `Avoidance signal: ${saved.avoidedThing}`,
                categoryId: saved.categoryId,
                sourceType: "Avoidance Check-In",
                sourceId: saved.id,
                actionToApply: saved.twoMinuteAction,
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}

function AvoidanceModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (checkIn: Partial<AvoidanceCheckIn> & Pick<AvoidanceCheckIn, "avoidedThing">) => void;
}) {
  const { data } = useLifeOps();
  const [avoidedThing, setAvoidedThing] = useState("");
  const [reason, setReason] = useState("");
  const [twoMinuteAction, setTwoMinuteAction] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();

  return (
    <Modal title="What Am I Avoiding?" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!avoidedThing.trim()) return;
          onSave({ avoidedThing, reason, twoMinuteAction, categoryId });
          onClose();
        }}
      >
        <Field label="What am I avoiding?">
          <input className="input" value={avoidedThing} onChange={(event) => setAvoidedThing(event.target.value)} />
        </Field>
        <Field label="Why am I avoiding it?">
          <textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Field label="Next 2-minute action">
          <input className="input" value={twoMinuteAction} onChange={(event) => setTwoMinuteAction(event.target.value)} />
        </Field>
        <Field label="Category">
          <CategorySelect categories={data.categories} value={categoryId} onChange={setCategoryId} />
        </Field>
        <button className="btn-primary w-full sm:w-auto" type="submit">
          Save Check-In
        </button>
      </form>
    </Modal>
  );
}

function LoopRow({
  loop,
  compact = false,
  onEdit,
}: {
  loop: OpenLoop;
  compact?: boolean;
  onEdit?: (loop: OpenLoop) => void;
}) {
  const { data, updateOpenLoop } = useLifeOps();
  const stale = isLoopStale(loop, data.settings.staleTaskDays);
  const unclear = needsNextAction(loop);
  const followUp = needsFollowUp(loop);
  const category = activeCategory(data.categories, loop.categoryId);
  return (
    <article className={`panel p-3 ${stale || unclear || followUp ? "border-amberline-500/60" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{loop.title}</h3>
            <span className="badge">{loop.priority}</span>
            <span className="badge">{loop.status}</span>
            {category ? <span className="badge">{category.name}</span> : null}
          </div>
          {!compact && loop.nextAction ? (
            <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">Next: {loop.nextAction}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {stale ? <span className="badge warning">Stale</span> : null}
            {unclear ? <span className="badge warning">Needs next action</span> : null}
            {followUp ? <span className="badge warning">Follow up</span> : null}
            {loop.dueDate ? <span className="badge">Due {formatDate(loop.dueDate)}</span> : null}
          </div>
          {!compact ? (
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
              Suggestion: {suggestForLoop(loop, data.settings.staleTaskDays)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {onEdit ? (
            <button className="btn-secondary min-h-10 px-3" onClick={() => onEdit(loop)}>
              Edit
            </button>
          ) : null}
          {!["Done", "Dropped"].includes(loop.status) ? (
            <button
              className="btn-secondary min-h-10 px-3"
              onClick={() => updateOpenLoop(loop.id, { status: "Done", completedAt: new Date().toISOString() })}
            >
              Done
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function OpenLoopsPage() {
  const { data, addOpenLoop, updateOpenLoop, addProject } = useLifeOps();
  const [editing, setEditing] = useState<OpenLoop | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const views = ["All", "Next Action", "Waiting", "Due Soon", "Stale", "Done", "Dropped"];

  const filtered = data.openLoops.filter((loop) => {
    if (loop.archivedAt) return false;
    if (categoryId && loop.categoryId !== categoryId) return false;
    if (search && !`${loop.title} ${loop.nextAction || ""} ${loop.notes || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "All") return true;
    if (filter === "Due Soon") return loop.dueDate ? loop.dueDate <= addDays(todayKey(), 7) : false;
    if (filter === "Stale") return isLoopStale(loop, data.settings.staleTaskDays);
    return loop.status === filter;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Open Loops"
        subtitle="Capture, clarify, and keep attention on the next visible action."
        action={<button className="btn-primary" onClick={() => setEditing({ id: "", title: "", status: "Captured", priority: "Medium", createdAt: "", updatedAt: "", lastTouchedAt: "" })}>Quick Add</button>}
      />
      <section className="card space-y-3">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <input className="input" placeholder="Search open loops" value={search} onChange={(event) => setSearch(event.target.value)} />
          <CategorySelect categories={data.categories} value={categoryId} onChange={setCategoryId} />
        </div>
        <div className="flex max-w-full flex-wrap gap-2 pb-1">
          {views.map((view) => (
            <button key={view} className={filter === view ? "btn-primary" : "btn-secondary"} onClick={() => setFilter(view)}>
              {view}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        {filtered.map((loop) => (
          <LoopRow key={loop.id} loop={loop} onEdit={setEditing} />
        ))}
        {!filtered.length ? <EmptyState title="No matching open loops" text="Try another view or capture one small loop." /> : null}
      </section>
      {editing ? (
        <LoopModal
          loop={editing.id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSave={(loop) => {
            if (editing.id) updateOpenLoop(editing.id, loop);
            else addOpenLoop({ ...loop, title: loop.title || "Untitled loop" });
            setEditing(null);
          }}
          onConvert={(loop) => {
            const project = addProject({
              name: loop.title,
              categoryId: loop.categoryId,
              status: "Planning",
              currentObjective: loop.notes,
              nextAction: loop.nextAction,
            });
            updateOpenLoop(loop.id, { relatedProjectId: project.id, status: "Done", completedAt: new Date().toISOString() });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LoopModal({
  loop,
  onClose,
  onSave,
  onConvert,
}: {
  loop?: OpenLoop;
  onClose: () => void;
  onSave: (loop: Partial<OpenLoop> & { title?: string }) => void;
  onConvert: (loop: OpenLoop) => void;
}) {
  const { data } = useLifeOps();
  const [draft, setDraft] = useState<Partial<OpenLoop>>(loop || { priority: "Medium", status: "Captured", repeat: "None" });

  function set<K extends keyof OpenLoop>(key: K, value: OpenLoop[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal title={loop ? "Edit Open Loop" : "Quick Add Open Loop"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft as Partial<OpenLoop> & { title?: string });
        }}
      >
        <Field label="Title">
          <input className="input" required value={draft.title || ""} onChange={(event) => set("title", event.target.value)} />
        </Field>
        <Field label="Next action">
          <input className="input" value={draft.nextAction || ""} onChange={(event) => set("nextAction", event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category">
            <CategorySelect categories={data.categories} value={draft.categoryId} onChange={(value) => set("categoryId", value)} />
          </Field>
          <Field label="Status">
            <select className="input" value={draft.status || "Captured"} onChange={(event) => set("status", event.target.value as OpenLoopStatus)}>
              {loopStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={draft.priority || "Medium"} onChange={(event) => set("priority", event.target.value as Priority)}>
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </Field>
        </div>
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink-700 dark:text-ink-200">Optional details</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Due date">
              <input className="input" type="date" value={draft.dueDate || ""} onChange={(event) => set("dueDate", event.target.value)} />
            </Field>
            <Field label="Follow-up date">
              <input className="input" type="date" value={draft.followUpDate || ""} onChange={(event) => set("followUpDate", event.target.value)} />
            </Field>
            <Field label="Repeat">
              <select className="input" value={draft.repeat || "None" as RepeatSetting} onChange={(event) => set("repeat", event.target.value as RepeatSetting)}>
                {repeatSettings.map((repeat) => <option key={repeat}>{repeat}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input min-h-28" value={draft.notes || ""} onChange={(event) => set("notes", event.target.value)} />
          </Field>
        </details>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" type="submit">Save</button>
          {loop ? <button className="btn-secondary" type="button" onClick={() => onSave({ status: "Dropped" })}>Drop</button> : null}
          {loop ? <button className="btn-secondary" type="button" onClick={() => onSave({ archivedAt: new Date().toISOString() })}>Archive</button> : null}
          {loop ? <button className="btn-secondary" type="button" onClick={() => onConvert(loop)}>Convert to Project</button> : null}
        </div>
      </form>
    </Modal>
  );
}

function ProjectCard({
  project,
  compact = false,
  onEdit,
}: {
  project: Project;
  compact?: boolean;
  onEdit?: (project: Project) => void;
}) {
  const { data, addOpenLoop, updateProject } = useLifeOps();
  const stale = isProjectStale(project, data.settings.staleProjectDays);
  return (
    <article className={`panel p-3 ${stale ? "border-amberline-500/60" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{project.name}</h3>
            <span className="badge">{project.status}</span>
            {stale ? <span className="badge warning">Stale</span> : null}
          </div>
          <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">
            {project.currentObjective || "No current objective set."}
          </p>
          {!compact ? (
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              Next: {suggestForProject(project, data.settings.staleProjectDays)}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
            Last worked: {project.lastWorkedAt ? formatDate(project.lastWorkedAt.slice(0, 10)) : "Not set"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEdit ? <button className="btn-secondary min-h-10 px-3" onClick={() => onEdit(project)}>Edit</button> : null}
          {!compact ? (
            <>
              <button
                className="btn-secondary min-h-10 px-3"
                onClick={() => {
                  if (project.nextAction) {
                    addOpenLoop({ title: project.nextAction, categoryId: project.categoryId, status: "Next Action", priority: "Medium", relatedProjectId: project.id });
                  }
                }}
              >
                Add Next Action
              </button>
              <button className="btn-secondary min-h-10 px-3" onClick={() => updateProject(project.id, { lastWorkedAt: new Date().toISOString() })}>
                Touched
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ProjectsPage({ setPage }: { setPage: (page: PageKey) => void }) {
  const { data, addProject, updateProject, addAAR } = useLifeOps();
  const [editing, setEditing] = useState<Project | null>(null);
  const active = data.projects.filter((project) => project.status !== "Archived");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        subtitle="Active personal projects without turning the app into a kanban board."
        action={<button className="btn-primary" onClick={() => setEditing({ id: "", name: "", status: "Idea", createdAt: "", updatedAt: "" })}>Create Project</button>}
      />
      <section className="space-y-3">
        {active.map((project) => (
          <div key={project.id} className="space-y-2">
            <ProjectCard project={project} onEdit={setEditing} />
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-secondary min-h-10 px-3"
                onClick={() => {
                  addAAR({ title: `${project.name} AAR`, type: "Project", relatedProjectId: project.id, intendedOutcome: project.currentObjective, nextAction: project.nextAction });
                  setPage("aars");
                }}
              >
                Start Project AAR
              </button>
              <button className="btn-secondary min-h-10 px-3" onClick={() => updateProject(project.id, { status: "Archived", archivedAt: new Date().toISOString() })}>
                Archive
              </button>
            </div>
          </div>
        ))}
      </section>
      {editing ? (
        <ProjectModal
          project={editing.id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSave={(project) => {
            if (editing.id) updateProject(editing.id, project);
            else addProject({ ...project, name: project.name || "Untitled project" });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ProjectModal({
  project,
  onClose,
  onSave,
}: {
  project?: Project;
  onClose: () => void;
  onSave: (project: Partial<Project> & { name?: string }) => void;
}) {
  const { data } = useLifeOps();
  const [draft, setDraft] = useState<Partial<Project>>(project || { status: "Idea", links: [] });
  function set<K extends keyof Project>(key: K, value: Project[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return (
    <Modal title={project ? "Edit Project" : "Create Project"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(draft as Partial<Project> & { name?: string }); }}>
        <Field label="Name"><input className="input" required value={draft.name || ""} onChange={(event) => set("name", event.target.value)} /></Field>
        <Field label="Current objective"><input className="input" value={draft.currentObjective || ""} onChange={(event) => set("currentObjective", event.target.value)} /></Field>
        <Field label="Next action"><input className="input" value={draft.nextAction || ""} onChange={(event) => set("nextAction", event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category"><CategorySelect categories={data.categories} value={draft.categoryId} onChange={(value) => set("categoryId", value)} /></Field>
          <Field label="Status">
            <select className="input" value={draft.status || "Idea"} onChange={(event) => set("status", event.target.value as ProjectStatus)}>
              {projectStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea className="input min-h-28" value={draft.notes || ""} onChange={(event) => set("notes", event.target.value)} /></Field>
        <button className="btn-primary" type="submit">Save Project</button>
      </form>
    </Modal>
  );
}

function AARPage() {
  const { data, addAAR, updateAAR, addOpenLoop, addLesson } = useLifeOps();
  const [editing, setEditing] = useState<AARReview | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader
        title="AAR Reviews"
        subtitle="Short, structured reviews that produce sustains, improves, lessons, and next actions."
        action={<button className="btn-primary" onClick={() => setEditing({ id: "", title: "", type: "Daily", date: todayKey(), tags: [], createdAt: "", updatedAt: "" })}>New AAR</button>}
      />
      <section className="space-y-3">
        {data.aarReviews.map((review) => (
          <article key={review.id} className="card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold">{review.title}</h3>
                  <span className="badge">{review.type}</span>
                  <span className="badge">{formatDate(review.date)}</span>
                </div>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                  {review.actualOutcome || review.intendedOutcome || "Open this review to complete the template."}
                </p>
                <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                  Suggestion: {suggestFromAAR(review)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary min-h-10 px-3" onClick={() => setEditing(review)}>Edit</button>
                <button className="btn-secondary min-h-10 px-3" onClick={() => exportAarMarkdown(review)}>Markdown</button>
                <button className="btn-secondary min-h-10 px-3" onClick={() => window.print()}>Print PDF</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryBlock title="Sustain" value={review.sustain} />
              <SummaryBlock title="Improve" value={review.improve} />
              <SummaryBlock title="Next Action" value={review.nextAction} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {review.nextAction ? (
                <button className="btn-secondary min-h-10 px-3" onClick={() => addOpenLoop({ title: review.nextAction || "AAR next action", status: "Next Action", priority: "Medium", relatedProjectId: review.relatedProjectId })}>
                  Add Next Action to Open Loops
                </button>
              ) : null}
              {(review.sustain || review.improve) ? (
                <button className="btn-secondary min-h-10 px-3" onClick={() => addLesson({ lesson: review.improve || review.sustain || "AAR lesson", sourceType: "AAR", sourceId: review.id, actionToApply: review.nextAction, categoryId: review.categoryId })}>
                  Save Lesson
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!data.aarReviews.length ? <EmptyState title="No AARs yet" text="Start with a daily review. Two minutes is enough." /> : null}
      </section>
      {editing ? (
        <AARModal
          review={editing.id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSave={(review) => {
            if (editing.id) updateAAR(editing.id, review);
            else addAAR({ ...review, title: review.title || `${review.type || "Daily"} AAR`, type: review.type || "Daily" });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryBlock({ title, value }: { title: string; value?: string }) {
  return (
    <div className="rounded-md bg-ink-50 p-3 dark:bg-ink-950">
      <p className="label">{title}</p>
      <p className="text-sm">{value || "Not captured yet."}</p>
    </div>
  );
}

function AARModal({
  review,
  onClose,
  onSave,
}: {
  review?: AARReview;
  onClose: () => void;
  onSave: (review: Partial<AARReview> & { title?: string; type?: AARType }) => void;
}) {
  const { data } = useLifeOps();
  const [draft, setDraft] = useState<Partial<AARReview>>(review || { type: "Daily", date: todayKey(), tags: [] });
  function set<K extends keyof AARReview>(key: K, value: AARReview[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const prompts = {
    Daily: ["What was the plan today?", "What actually happened?", "What went well?", "What got avoided or went wrong?", "What should I sustain tomorrow?", "What should I improve tomorrow?", "What is one next action?"],
    Weekly: ["What was the mission this week?", "What got completed?", "What stayed stuck?", "What pattern showed up?", "What should I sustain?", "What should I improve?", "What is next week's main mission?"],
    Project: ["What was the project objective?", "What changed from the original plan?", "What got completed?", "What blockers came up?", "What did I learn?", "What is the next build step?"],
    Custom: ["What was supposed to happen?", "What actually happened?", "What should change next?"],
  }[draft.type || "Daily"];
  return (
    <Modal title={review ? "Edit AAR" : "New AAR"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(draft as Partial<AARReview> & { title?: string; type?: AARType }); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type">
            <select className="input" value={draft.type || "Daily"} onChange={(event) => set("type", event.target.value as AARType)}>
              {aarTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className="input" value={draft.date || todayKey()} onChange={(event) => set("date", event.target.value)} /></Field>
          <Field label="Category"><CategorySelect categories={data.categories} value={draft.categoryId} onChange={(value) => set("categoryId", value)} /></Field>
        </div>
        <Field label="Title"><input className="input" value={draft.title || ""} onChange={(event) => set("title", event.target.value)} /></Field>
        <div className="rounded-md bg-ink-50 p-3 text-sm dark:bg-ink-950">
          <p className="font-semibold">Template prompts</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-600 dark:text-ink-300">
            {prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
          </ol>
        </div>
        <Field label="What was supposed to happen?"><textarea className="input" value={draft.intendedOutcome || ""} onChange={(event) => set("intendedOutcome", event.target.value)} /></Field>
        <Field label="What actually happened?"><textarea className="input" value={draft.actualOutcome || ""} onChange={(event) => set("actualOutcome", event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What went well?"><textarea className="input" value={draft.wentWell || ""} onChange={(event) => set("wentWell", event.target.value)} /></Field>
          <Field label="What went wrong or got avoided?"><textarea className="input" value={draft.wentWrong || ""} onChange={(event) => set("wentWrong", event.target.value)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Sustain"><textarea className="input" value={draft.sustain || ""} onChange={(event) => set("sustain", event.target.value)} /></Field>
          <Field label="Improve"><textarea className="input" value={draft.improve || ""} onChange={(event) => set("improve", event.target.value)} /></Field>
          <Field label="Next action"><textarea className="input" value={draft.nextAction || ""} onChange={(event) => set("nextAction", event.target.value)} /></Field>
        </div>
        <Field label="Tags">
          <input className="input" value={(draft.tags || []).join(", ")} onChange={(event) => set("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="comma separated" />
        </Field>
        <button className="btn-primary" type="submit">Save Review</button>
      </form>
    </Modal>
  );
}

function LessonsPage() {
  const { data, addLesson, updateLesson } = useLifeOps();
  const [editing, setEditing] = useState<LessonLearned | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const lessons = data.lessons.filter((lesson) => {
    if (status !== "All" && lesson.status !== status) return false;
    return !search || `${lesson.lesson} ${lesson.actionToApply || ""}`.toLowerCase().includes(search.toLowerCase());
  });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Lessons Learned"
        subtitle="A library of useful patterns from reviews, check-ins, projects, and failures."
        action={<button className="btn-primary" onClick={() => setEditing({ id: "", lesson: "", status: "Active", createdAt: "", updatedAt: "" })}>Add Lesson</button>}
      />
      <section className="card grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input className="input" placeholder="Search lessons" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
          {["All", "Active", "Applied", "Archived"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => exportLessonsMarkdown(data.lessons)}>Export Markdown</button>
      </section>
      <section className="space-y-3">
        {lessons.map((lesson) => (
          <article key={lesson.id} className="card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{lesson.lesson}</h3>
                  <span className="badge">{lesson.status}</span>
                  {lesson.sourceType ? <span className="badge">{lesson.sourceType}</span> : null}
                </div>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                  Apply: {lesson.actionToApply || "Keep visible during planning."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary min-h-10 px-3" onClick={() => setEditing(lesson)}>Edit</button>
                <button className="btn-secondary min-h-10 px-3" onClick={() => updateLesson(lesson.id, { status: "Applied", lastReviewedAt: new Date().toISOString() })}>Applied</button>
                <button className="btn-secondary min-h-10 px-3" onClick={() => updateLesson(lesson.id, { status: "Archived" })}>Archive</button>
              </div>
            </div>
          </article>
        ))}
      </section>
      {editing ? (
        <LessonModal
          lesson={editing.id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSave={(lesson) => {
            if (editing.id) updateLesson(editing.id, lesson);
            else addLesson({ ...lesson, lesson: lesson.lesson || "Untitled lesson" });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LessonModal({
  lesson,
  onClose,
  onSave,
}: {
  lesson?: LessonLearned;
  onClose: () => void;
  onSave: (lesson: Partial<LessonLearned> & { lesson?: string }) => void;
}) {
  const { data } = useLifeOps();
  const [draft, setDraft] = useState<Partial<LessonLearned>>(lesson || { status: "Active", sourceType: "Manual" });
  function set<K extends keyof LessonLearned>(key: K, value: LessonLearned[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return (
    <Modal title={lesson ? "Edit Lesson" : "Add Lesson"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(draft as Partial<LessonLearned> & { lesson?: string }); }}>
        <Field label="Lesson"><textarea className="input" required value={draft.lesson || ""} onChange={(event) => set("lesson", event.target.value)} /></Field>
        <Field label="Action to apply"><input className="input" value={draft.actionToApply || ""} onChange={(event) => set("actionToApply", event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category"><CategorySelect categories={data.categories} value={draft.categoryId} onChange={(value) => set("categoryId", value)} /></Field>
          <Field label="Status">
            <select className="input" value={draft.status || "Active"} onChange={(event) => set("status", event.target.value as LessonLearned["status"])}>
              {["Active", "Applied", "Archived"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>
        <button className="btn-primary" type="submit">Save Lesson</button>
      </form>
    </Modal>
  );
}

function FinancePage({ setPage }: { setPage: (page: PageKey) => void }) {
  const { data, updateFinance, addAAR, addOpenLoop } = useLifeOps();
  const finance = data.finance;
  const summary = getFinanceSummary(finance);
  const recommendation = getNextDollarRecommendation(finance);
  const [windfallAmount, setWindfallAmount] = useState(0);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const annualChecklist = finance.annualChecklist || [];
  const nextMilestone = hfosMilestones.find((milestone) => summary.invested < milestone.amount);
  const expensesSet = (finance.assumptions.annualEssentialExpenses || 0) > 0;
  const accountAdds = finance.accounts
    .filter((account) => investedAccountTypes.includes(account.type))
    .reduce((sum, account) => sum + (account.annualContribution || 0), 0);
  const reviewProgress = finance.quarterlyChecklist.length
    ? (finance.quarterlyChecklist.filter((item) => item.completed).length /
        finance.quarterlyChecklist.length) *
      100
    : 0;

  function patchFinance(patch: Partial<FinancialData>) {
    updateFinance((current) => ({ ...current, ...patch }));
  }

  function patchAccount(id: string, patch: Partial<(typeof finance.accounts)[number]>) {
    updateFinance((current) => ({
      ...current,
      accounts: current.accounts.map((account) =>
        account.id === id ? { ...account, ...patch, updatedAt: new Date().toISOString() } : account,
      ),
    }));
  }

  function patchHolding(id: string, patch: Partial<(typeof finance.holdings)[number]>) {
    updateFinance((current) => ({
      ...current,
      holdings: current.holdings.map((holding) =>
        holding.id === id ? { ...holding, ...patch, updatedAt: new Date().toISOString() } : holding,
      ),
    }));
  }

  function patchAssumption(key: keyof FinancialData["assumptions"], value: number | undefined) {
    updateFinance((current) => ({
      ...current,
      assumptions: { ...current.assumptions, [key]: value },
    }));
  }

  function toggleReviewItem(
    list: "quarterlyChecklist" | "annualChecklist",
    id: string,
    completed: boolean,
  ) {
    updateFinance((current) => ({
      ...current,
      [list]: (current[list] || []).map((item) =>
        item.id === id ? { ...item, completed } : item,
      ),
    }));
  }

  function createFinanceAar() {
    const incomplete = finance.quarterlyChecklist
      .filter((item) => !item.completed)
      .map((item) => item.label)
      .join("\n");
    addAAR({
      title: `Quarterly Financial Review - ${formatDate(todayKey())}`,
      type: "Custom",
      intendedOutcome: finance.mission,
      actualOutcome: `Invested: ${formatMoney(summary.invested)}. Net worth: ${formatMoney(summary.netWorth)}. FI progress: ${formatPercent(summary.fiProgress)}.`,
      sustain: finance.principles.join("\n"),
      improve: incomplete || "Checklist complete. Maintain the system.",
      nextAction: recommendation.title,
      tags: ["finance", "HFOS"],
    });
    setPage("aars");
  }

  function createNextDollarLoop() {
    addOpenLoop({
      title: recommendation.title,
      status: "Next Action",
      priority: "High",
      notes: recommendation.detail,
    });
    setPage("loops");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financial Command Center"
        subtitle={finance.mission}
        action={
          <button className="btn-primary" onClick={createFinanceAar}>
            Create Finance AAR
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="label">Net Worth</p>
          <p className="text-2xl font-black">{formatMoney(summary.netWorth)}</p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            Assets {formatMoney(summary.assets)} minus debt {formatMoney(summary.debt)}
          </p>
        </div>
        <div className="card">
          <p className="label">Invested</p>
          <p className="text-2xl font-black">{formatMoney(summary.invested)}</p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            TSP + IRA + brokerage. This drives FI progress.
          </p>
        </div>
        <div className="card">
          <p className="label">FI Progress</p>
          <p className="text-2xl font-black">{formatPercent(summary.fiProgress)}</p>
          <div className="mt-3 h-2 rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-2 rounded-full bg-signal-600"
              style={{ width: `${Math.max(2, Math.min(100, summary.fiProgress))}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
            Target {formatMoney(summary.fiTarget)}
            {expensesSet ? " (from expenses)" : ""}
          </p>
        </div>
        <div className="card">
          <p className="label">FI Countdown</p>
          <p className="text-2xl font-black">
            {summary.fiYears === null ? "Set plan" : summary.fiYears === 0 ? "Reached" : `${summary.fiYears} yrs`}
          </p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            Based on {formatMoney(summary.annualInvestment)} yearly at{" "}
            {formatPercent(finance.assumptions.expectedAnnualReturn * 100)}
          </p>
        </div>
      </section>

      <section className="card border-signal-500/40 bg-signal-50/60 dark:bg-signal-500/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="label">Next dollar goes here</p>
            <h3 className="text-xl font-bold">{recommendation.title}</h3>
            <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">{recommendation.detail}</p>
          </div>
          <button className="btn-primary" onClick={createNextDollarLoop}>
            Make Task
          </button>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {recommendation.steps.map((step, index) => (
            <li
              key={step.label}
              className={`panel flex items-center gap-2 p-2 text-sm ${
                step.state === "current"
                  ? "border-signal-500 font-bold"
                  : step.state === "done"
                    ? "opacity-60"
                    : "opacity-40"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.state === "done"
                    ? "bg-signal-600 text-white"
                    : step.state === "current"
                      ? "border-2 border-signal-600 text-signal-600"
                      : "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300"
                }`}
              >
                {step.state === "done" ? "✓" : index + 1}
              </span>
              {step.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="text-xl font-bold">Stay the Path</h3>
          <div className="space-y-2 text-sm text-ink-700 dark:text-ink-200">
            <p className="panel p-2"><strong>Down 10% or 20%</strong> → Keep buying.</p>
            <p className="panel p-2"><strong>Down 40%</strong> → Keep buying if the emergency fund and cash flow are healthy.</p>
            <p className="panel p-2"><strong>Down 50%+</strong> → Keep buying if able. Change nothing for 30 days.</p>
            <p className="panel p-2 font-bold">Never panic sell. This card is why the system exists.</p>
          </div>
          <p className="text-sm text-ink-600 dark:text-ink-300">
            <strong>Sell only if:</strong> the thesis broke, the money is genuinely needed, or
            contributions cannot rebalance within a year.
          </p>
          <p className="text-sm text-ink-600 dark:text-ink-300">
            <strong>Unsure?</strong> Wait 24 hours → re-read the HFOS → buy SCHB.
          </p>
        </div>

        <div className="card space-y-3">
          <h3 className="text-xl font-bold">Windfall & Raise Rules</h3>
          <Field label="Windfall received">
            <input
              className="input"
              type="number"
              value={windfallAmount || ""}
              placeholder="0"
              onChange={(event) => setWindfallAmount(Number(event.target.value))}
            />
          </Field>
          {windfallAmount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                Enjoy {formatMoney(windfallAmount * 0.2)} · Invest {formatMoney(windfallAmount * 0.8)}
              </p>
              <button
                className="btn-secondary"
                onClick={() =>
                  addOpenLoop({
                    title: `Invest ${formatMoney(windfallAmount * 0.8)} of windfall (80/20 rule)`,
                    status: "Next Action",
                    priority: "High",
                    notes: `Windfall of ${formatMoney(windfallAmount)}: enjoy ${formatMoney(windfallAmount * 0.2)}, invest ${formatMoney(windfallAmount * 0.8)} per the decision tree.`,
                  })
                }
              >
                Make Task
              </button>
            </div>
          ) : null}
          <Field label="Annual raise amount">
            <input
              className="input"
              type="number"
              value={raiseAmount || ""}
              placeholder="0"
              onChange={(event) => setRaiseAmount(Number(event.target.value))}
            />
          </Field>
          {raiseAmount > 0 ? (
            <p className="text-sm font-semibold">
              Increase investing by {formatMoney(raiseAmount * 0.5)}/yr · Lifestyle {formatMoney(raiseAmount * 0.5)}/yr
            </p>
          ) : null}
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h3 className="text-xl font-bold">Accounts & Holdings</h3>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            Update holding values quarterly. Account balances and totals compute themselves.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {finance.accounts.map((account) => {
            const holdings = finance.holdings.filter((holding) => holding.accountId === account.id);
            const balance = accountBalance(finance, account.id);
            const isInvested = investedAccountTypes.includes(account.type);
            return (
              <article key={account.id} className="panel p-3">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold">{account.name}</p>
                    <p className="text-sm text-ink-600 dark:text-ink-300">{account.targetRole}</p>
                  </div>
                  <p className="text-lg font-black">{formatMoney(balance)}</p>
                </div>
                {holdings.length ? (
                  <div className="mt-3 space-y-2">
                    {holdings.map((holding) => {
                      const actual = balance > 0 ? (holding.value / balance) * 100 : 0;
                      const target = holding.targetPercent || 0;
                      const outsideBand = balance > 0 && Math.abs(actual - target) > 5;
                      return (
                        <div key={holding.id} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_auto]">
                          <span className="text-sm font-semibold">{holding.name}</span>
                          <input
                            className="input w-32"
                            type="number"
                            value={holding.value}
                            onChange={(event) =>
                              patchHolding(holding.id, { value: Number(event.target.value) })
                            }
                          />
                          <span
                            className={`text-sm ${
                              outsideBand
                                ? "font-bold text-coral-700 dark:text-coral-500"
                                : "text-ink-600 dark:text-ink-300"
                            }`}
                          >
                            {formatPercent(actual)} vs {target}%
                            {outsideBand ? " — rebalance with new dollars" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3">
                    <Field label={account.type === "Debt" ? "Debt balance" : "Balance"}>
                      <input
                        className="input"
                        type="number"
                        value={account.balance}
                        onChange={(event) =>
                          patchAccount(account.id, { balance: Number(event.target.value) })
                        }
                      />
                    </Field>
                  </div>
                )}
                {isInvested ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Added this year">
                      <input
                        className="input"
                        type="number"
                        value={account.annualContribution || 0}
                        onChange={(event) =>
                          patchAccount(account.id, { annualContribution: Number(event.target.value) })
                        }
                      />
                    </Field>
                    {account.type === "TSP" || account.type === "Roth IRA" ? (
                      <Field label="Annual limit">
                        <input
                          className="input"
                          type="number"
                          value={account.annualLimit || 0}
                          onChange={(event) =>
                            patchAccount(account.id, { annualLimit: Number(event.target.value) })
                          }
                        />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="card space-y-2">
        <h3 className="text-xl font-bold">Milestones</h3>
        <p className="text-sm text-ink-600 dark:text-ink-300">Measured in invested assets.</p>
        <div className="space-y-2">
          {hfosMilestones.map((milestone) => {
            const reached = summary.invested >= milestone.amount;
            const isNext = nextMilestone?.amount === milestone.amount;
            return (
              <div
                key={milestone.amount}
                className={`panel flex flex-wrap items-center justify-between gap-2 p-3 text-sm ${
                  isNext ? "border-signal-500" : reached ? "opacity-60" : "opacity-40"
                }`}
              >
                <span className="font-bold">
                  {reached ? "✓ " : ""}
                  {formatMoney(milestone.amount)}
                </span>
                <span className="text-ink-700 dark:text-ink-200">{milestone.action}</span>
                {isNext ? (
                  <span className="badge">{formatMoney(milestone.amount - summary.invested)} to go</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="text-xl font-bold">Retirement and FI Assumptions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Annual essential expenses">
              <input
                className="input"
                type="number"
                value={finance.assumptions.annualEssentialExpenses || 0}
                onChange={(event) =>
                  patchAssumption("annualEssentialExpenses", Number(event.target.value))
                }
              />
            </Field>
            <Field label="Expected return %">
              <input
                className="input"
                type="number"
                value={Math.round(finance.assumptions.expectedAnnualReturn * 1000) / 10}
                onChange={(event) =>
                  patchAssumption("expectedAnnualReturn", Number(event.target.value) / 100)
                }
              />
            </Field>
            <Field label="Pension monthly">
              <input
                className="input"
                type="number"
                value={finance.assumptions.pensionMonthly || 0}
                onChange={(event) => patchAssumption("pensionMonthly", Number(event.target.value))}
              />
            </Field>
            <Field label="Social Security monthly">
              <input
                className="input"
                type="number"
                value={finance.assumptions.socialSecurityMonthly || 0}
                onChange={(event) => patchAssumption("socialSecurityMonthly", Number(event.target.value))}
              />
            </Field>
            {!expensesSet ? (
              <Field label="FI target (manual)">
                <input
                  className="input"
                  type="number"
                  value={finance.assumptions.targetFiNumber}
                  onChange={(event) => patchAssumption("targetFiNumber", Number(event.target.value))}
                />
              </Field>
            ) : null}
            {!expensesSet ? (
              <Field label="Emergency target (manual)">
                <input
                  className="input"
                  type="number"
                  value={finance.assumptions.emergencyFundTarget}
                  onChange={(event) => patchAssumption("emergencyFundTarget", Number(event.target.value))}
                />
              </Field>
            ) : null}
            {accountAdds <= 0 ? (
              <Field label="Annual investment (manual)">
                <input
                  className="input"
                  type="number"
                  value={finance.assumptions.annualInvestment}
                  onChange={(event) => patchAssumption("annualInvestment", Number(event.target.value))}
                />
              </Field>
            ) : null}
          </div>
          <label className="panel flex items-start gap-3 p-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-signal-600"
              checked={finance.assumptions.tspMatchCaptured !== false}
              onChange={(event) =>
                updateFinance((current) => ({
                  ...current,
                  assumptions: { ...current.assumptions, tspMatchCaptured: event.target.checked },
                }))
              }
            />
            <span className="text-sm font-semibold">
              TSP is getting at least 5% (full match captured)
            </span>
          </label>
          <p className="text-sm text-ink-600 dark:text-ink-300">
            In use: FI target <strong>{formatMoney(summary.fiTarget)}</strong>
            {expensesSet ? " = (expenses − pension − SS) × 25" : " (manual)"} · Emergency
            target <strong>{formatMoney(summary.efTarget)}</strong>
            {expensesSet ? " = 6 months of expenses" : " (manual)"} · Investing{" "}
            <strong>{formatMoney(summary.annualInvestment)}/yr</strong>
            {accountAdds > 0 ? " from account adds" : " (manual)"}
          </p>
        </div>

        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Quarterly Financial Review</h3>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                AAR-style checklist for the money system.
              </p>
            </div>
            <span className="badge">{formatPercent(reviewProgress)}</span>
          </div>
          <div className="space-y-2">
            {finance.quarterlyChecklist.map((item) => (
              <label key={item.id} className="panel flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-signal-600"
                  checked={item.completed}
                  onChange={(event) => toggleReviewItem("quarterlyChecklist", item.id, event.target.checked)}
                />
                <span className="text-sm font-semibold">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={createFinanceAar}>
              Save Review AAR
            </button>
            <button className="btn-secondary" onClick={() => exportDataJson(data)}>
              Export Backup
            </button>
            <button
              className="btn-secondary"
              onClick={() =>
                patchFinance({
                  quarterlyChecklist: finance.quarterlyChecklist.map((item) => ({
                    ...item,
                    completed: false,
                  })),
                })
              }
            >
              Reset Checklist
            </button>
          </div>
        </div>

        <div className="card space-y-3">
          <div>
            <h3 className="text-xl font-bold">Annual Review</h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              Once a year, on top of the quarterly review.
            </p>
          </div>
          <div className="space-y-2">
            {annualChecklist.map((item) => (
              <label key={item.id} className="panel flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-signal-600"
                  checked={item.completed}
                  onChange={(event) => toggleReviewItem("annualChecklist", item.id, event.target.checked)}
                />
                <span className="text-sm font-semibold">{item.label}</span>
              </label>
            ))}
          </div>
          <button
            className="btn-secondary"
            onClick={() =>
              patchFinance({
                annualChecklist: annualChecklist.map((item) => ({
                  ...item,
                  completed: false,
                })),
              })
            }
          >
            Reset Annual Checklist
          </button>
        </div>
      </section>

      <section className="card grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xl font-bold">Priority Order</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-700 dark:text-ink-200">
            {finance.priorityOrder.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="text-xl font-bold">HFOS Principles</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-ink-200">
            {finance.principles.map((item) => (
              <li key={item} className="rounded-md bg-ink-50 p-3 dark:bg-ink-950">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function SettingsPage() {
  const { data, updateSettings, updateCategory, addCategory, replaceData, resetData } = useLifeOps();
  const [newCategory, setNewCategory] = useState("");
  const [minimumDefaults, setMinimumDefaults] = useState(data.settings.minimumDayDefaults.join("\n"));
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Local data, theme, categories, thresholds, and backups." />
      <section className="card grid gap-4 md:grid-cols-2">
        <Field label="Theme">
          <select className="input" value={data.settings.theme} onChange={(event) => updateSettings({ theme: event.target.value as typeof data.settings.theme })}>
            {["system", "light", "dark"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="AI suggestions">
          <select className="input" value={data.settings.aiSuggestionsEnabled ? "on" : "off"} onChange={(event) => updateSettings({ aiSuggestionsEnabled: event.target.value === "on" })}>
            <option value="off">Off</option>
            <option value="on">On, local wrapper only</option>
          </select>
        </Field>
        <Field label="Stale task threshold">
          <input className="input" type="number" min={1} value={data.settings.staleTaskDays} onChange={(event) => updateSettings({ staleTaskDays: Number(event.target.value) })} />
        </Field>
        <Field label="Stale project threshold">
          <input className="input" type="number" min={1} value={data.settings.staleProjectDays} onChange={(event) => updateSettings({ staleProjectDays: Number(event.target.value) })} />
        </Field>
      </section>
      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Data Backup</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => exportDataJson(data)}>Export JSON</button>
          <label className="btn-secondary cursor-pointer">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const imported = await importDataFromFile(file);
                replaceData(imported);
              }}
            />
          </label>
          <button
            className="btn-danger"
            onClick={() => {
              if (window.confirm("Clear local LifeOps data and restore editable seed data?")) void resetData();
            }}
          >
            Clear Local Data
          </button>
        </div>
      </section>
      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Categories</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((category) => (
            <div key={category.id} className="panel flex min-w-0 flex-col gap-2 p-2 min-[390px]:flex-row min-[390px]:items-center">
              <span className="h-4 w-4 flex-none rounded-full" style={{ backgroundColor: category.color || "#64748b" }} />
              <input className="input min-h-10 min-w-0 flex-1" value={category.name} onChange={(event) => updateCategory(category.id, { name: event.target.value })} />
              <button className="btn-secondary min-h-10 px-3" onClick={() => updateCategory(category.id, { archived: !category.archived })}>
                {category.archived ? "Unarchive" : "Archive"}
              </button>
            </div>
          ))}
        </div>
        <form className="flex min-w-0 flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (newCategory.trim()) { addCategory(newCategory.trim()); setNewCategory(""); } }}>
          <input className="input min-w-0 flex-1" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Add category" />
          <button className="btn-primary" type="submit">Add</button>
        </form>
      </section>
      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Minimum Viable Day Defaults</h2>
        <textarea className="input min-h-36" value={minimumDefaults} onChange={(event) => setMinimumDefaults(event.target.value)} />
        <button className="btn-primary" onClick={() => updateSettings({ minimumDayDefaults: minimumDefaults.split("\n").map((item) => item.trim()).filter(Boolean) })}>
          Save Defaults
        </button>
      </section>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-600 dark:text-ink-300">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function QuickAddModal({ onClose, setPage }: { onClose: () => void; setPage: (page: PageKey) => void }) {
  const { data, addOpenLoop, addProject, addAAR, addLesson, addHabit, addAvoidance } = useLifeOps();
  const [kind, setKind] = useState<QuickAddKind>("Open Loop");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [priority, setPriority] = useState<Priority>("Medium");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (kind === "Open Loop") {
      addOpenLoop({ title, categoryId, priority, nextAction, notes, status: nextAction ? "Next Action" : "Captured" });
      setPage("loops");
    }
    if (kind === "Project") {
      addProject({ name: title, categoryId, nextAction, currentObjective: notes, status: "Idea" });
      setPage("projects");
    }
    if (kind === "AAR") {
      addAAR({ title, type: "Daily", categoryId, nextAction, actualOutcome: notes });
      setPage("aars");
    }
    if (kind === "Lesson") {
      addLesson({ lesson: title, categoryId, actionToApply: nextAction || notes });
      setPage("lessons");
    }
    if (kind === "Habit") {
      addHabit({ name: title, categoryId, minimumVersion: nextAction || notes });
      setPage("dashboard");
    }
    if (kind === "Avoidance Check-In") {
      addAvoidance({ avoidedThing: title, categoryId, twoMinuteAction: nextAction, reason: notes });
      setPage("dashboard");
    }
    onClose();
  }

  return (
    <Modal title="Quick Add" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Capture type">
          <select className="input" value={kind} onChange={(event) => setKind(event.target.value as QuickAddKind)}>
            {["Open Loop", "Project", "AAR", "Lesson", "Avoidance Check-In", "Habit"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label={kind === "Avoidance Check-In" ? "What am I avoiding?" : "Title"}>
          <input className="input" autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category"><CategorySelect categories={data.categories} value={categoryId} onChange={setCategoryId} /></Field>
          {kind === "Open Loop" ? (
            <Field label="Priority">
              <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                {priorities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          ) : null}
        </div>
        <Field label={kind === "Habit" ? "Minimum version" : "Next action"}>
          <input className="input" value={nextAction} onChange={(event) => setNextAction(event.target.value)} />
        </Field>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-ink-700 dark:text-ink-200">Optional note</summary>
          <textarea className="input mt-3 min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </details>
        <button className="btn-primary w-full sm:w-auto" type="submit">Save</button>
      </form>
    </Modal>
  );
}

export function App() {
  const { ready } = useLifeOps();
  const [page, setPage] = useState<PageKey>("dashboard");
  const [quickAdd, setQuickAdd] = useState(false);

  const content = useMemo(() => {
    if (page === "dashboard") return <Dashboard setPage={setPage} />;
    if (page === "loops") return <OpenLoopsPage />;
    if (page === "projects") return <ProjectsPage setPage={setPage} />;
    if (page === "aars") return <AARPage />;
    if (page === "lessons") return <LessonsPage />;
    if (page === "finance") return <FinancePage setPage={setPage} />;
    return <SettingsPage />;
  }, [page]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-white">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.18em] text-signal-500">LifeOps</p>
          <p className="mt-2 text-xl font-bold">Loading command center</p>
        </div>
      </div>
    );
  }

  return (
    <Layout page={page} setPage={setPage} onQuickAdd={() => setQuickAdd(true)}>
      {content}
      {quickAdd ? <QuickAddModal onClose={() => setQuickAdd(false)} setPage={setPage} /> : null}
    </Layout>
  );
}
