import React, { useState } from "react";
import { Sheet as Modal } from "./components/Sheet";
import { useLifeOps } from "./state/LifeOpsContext";
import type {
  Category,
  AvoidanceCheckIn,
  AARReview,
  AARType,
  LessonLearned,
} from "./types";
import { formatDate, todayKey } from "./utils/date";
import { exportAarMarkdown, exportLessonsMarkdown } from "./utils/exporters";
import { suggestFromAAR } from "./utils/rules";
const aarTypes: AARType[] = ["Daily", "Weekly", "Project", "Custom"];
function activeCategory(
  categories: Category[],
  id?: string,
): Category | undefined {
  return categories.find((category) => category.id === id);
}

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

export function AvoidanceModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (
    checkIn: Partial<AvoidanceCheckIn> & Pick<AvoidanceCheckIn, "avoidedThing">,
  ) => void;
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
          <input
            className="input"
            value={avoidedThing}
            onChange={(event) => setAvoidedThing(event.target.value)}
          />
        </Field>
        <Field label="Why am I avoiding it?">
          <textarea
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Field label="Next 2-minute action">
          <input
            className="input"
            value={twoMinuteAction}
            onChange={(event) => setTwoMinuteAction(event.target.value)}
          />
        </Field>
        <Field label="Category">
          <CategorySelect
            categories={data.categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        </Field>
        <button className="btn-primary w-full sm:w-auto" type="submit">
          Save Check-In
        </button>
      </form>
    </Modal>
  );
}

export function AARPage() {
  const { data, addAAR, updateAAR, addOpenLoop, addLesson } = useLifeOps();
  const [editing, setEditing] = useState<AARReview | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader
        title="AAR Reviews"
        subtitle="Short, structured reviews that produce sustains, improves, lessons, and next actions."
        action={
          <button
            className="btn-primary"
            onClick={() =>
              setEditing({
                id: "",
                title: "",
                type: "Daily",
                date: todayKey(),
                tags: [],
                createdAt: "",
                updatedAt: "",
              })
            }
          >
            New AAR
          </button>
        }
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
                  {review.actualOutcome ||
                    review.intendedOutcome ||
                    "Open this review to complete the template."}
                </p>
                <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                  Suggestion: {suggestFromAAR(review)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() => setEditing(review)}
                >
                  Edit
                </button>
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() => exportAarMarkdown(review)}
                >
                  Markdown
                </button>
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() => window.print()}
                >
                  Print PDF
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryBlock title="Sustain" value={review.sustain} />
              <SummaryBlock title="Improve" value={review.improve} />
              <SummaryBlock title="Next Action" value={review.nextAction} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {review.nextAction ? (
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() =>
                    addOpenLoop({
                      title: review.nextAction || "AAR next action",
                      status: "Next Action",
                      priority: "Medium",
                      relatedProjectId: review.relatedProjectId,
                    })
                  }
                >
                  Add Next Action to Open Loops
                </button>
              ) : null}
              {review.sustain || review.improve ? (
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() =>
                    addLesson({
                      lesson: review.improve || review.sustain || "AAR lesson",
                      sourceType: "AAR",
                      sourceId: review.id,
                      actionToApply: review.nextAction,
                      categoryId: review.categoryId,
                    })
                  }
                >
                  Save Lesson
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!data.aarReviews.length ? (
          <EmptyState
            title="No AARs yet"
            text="Start with a daily review. Two minutes is enough."
          />
        ) : null}
      </section>
      {editing ? (
        <AARModal
          review={editing.id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSave={(review) => {
            if (editing.id) updateAAR(editing.id, review);
            else
              addAAR({
                ...review,
                title: review.title || `${review.type || "Daily"} AAR`,
                type: review.type || "Daily",
              });
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
  onSave: (
    review: Partial<AARReview> & { title?: string; type?: AARType },
  ) => void;
}) {
  const { data } = useLifeOps();
  const [draft, setDraft] = useState<Partial<AARReview>>(
    review || { type: "Daily", date: todayKey(), tags: [] },
  );
  function set<K extends keyof AARReview>(key: K, value: AARReview[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const prompts = {
    Daily: [
      "What was the plan today?",
      "What actually happened?",
      "What went well?",
      "What got avoided or went wrong?",
      "What should I sustain tomorrow?",
      "What should I improve tomorrow?",
      "What is one next action?",
    ],
    Weekly: [
      "What was the mission this week?",
      "What got completed?",
      "What stayed stuck?",
      "What pattern showed up?",
      "What should I sustain?",
      "What should I improve?",
      "What is next week's main mission?",
    ],
    Project: [
      "What was the project objective?",
      "What changed from the original plan?",
      "What got completed?",
      "What blockers came up?",
      "What did I learn?",
      "What is the next build step?",
    ],
    Custom: [
      "What was supposed to happen?",
      "What actually happened?",
      "What should change next?",
    ],
  }[draft.type || "Daily"];
  return (
    <Modal title={review ? "Edit AAR" : "New AAR"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            draft as Partial<AARReview> & { title?: string; type?: AARType },
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type">
            <select
              className="input"
              value={draft.type || "Daily"}
              onChange={(event) => set("type", event.target.value as AARType)}
            >
              {aarTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              className="input"
              value={draft.date || todayKey()}
              onChange={(event) => set("date", event.target.value)}
            />
          </Field>
          <Field label="Category">
            <CategorySelect
              categories={data.categories}
              value={draft.categoryId}
              onChange={(value) => set("categoryId", value)}
            />
          </Field>
        </div>
        <Field label="Title">
          <input
            className="input"
            value={draft.title || ""}
            onChange={(event) => set("title", event.target.value)}
          />
        </Field>
        <div className="rounded-md bg-ink-50 p-3 text-sm dark:bg-ink-950">
          <p className="font-semibold">Template prompts</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-600 dark:text-ink-300">
            {prompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ol>
        </div>
        <Field label="What was supposed to happen?">
          <textarea
            className="input"
            value={draft.intendedOutcome || ""}
            onChange={(event) => set("intendedOutcome", event.target.value)}
          />
        </Field>
        <Field label="What actually happened?">
          <textarea
            className="input"
            value={draft.actualOutcome || ""}
            onChange={(event) => set("actualOutcome", event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What went well?">
            <textarea
              className="input"
              value={draft.wentWell || ""}
              onChange={(event) => set("wentWell", event.target.value)}
            />
          </Field>
          <Field label="What went wrong or got avoided?">
            <textarea
              className="input"
              value={draft.wentWrong || ""}
              onChange={(event) => set("wentWrong", event.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Sustain">
            <textarea
              className="input"
              value={draft.sustain || ""}
              onChange={(event) => set("sustain", event.target.value)}
            />
          </Field>
          <Field label="Improve">
            <textarea
              className="input"
              value={draft.improve || ""}
              onChange={(event) => set("improve", event.target.value)}
            />
          </Field>
          <Field label="Next action">
            <textarea
              className="input"
              value={draft.nextAction || ""}
              onChange={(event) => set("nextAction", event.target.value)}
            />
          </Field>
        </div>
        <Field label="Tags">
          <input
            className="input"
            value={(draft.tags || []).join(", ")}
            onChange={(event) =>
              set(
                "tags",
                event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              )
            }
            placeholder="comma separated"
          />
        </Field>
        <button className="btn-primary" type="submit">
          Save Review
        </button>
      </form>
    </Modal>
  );
}

export function LessonsPage() {
  const { data, addLesson, updateLesson } = useLifeOps();
  const [editing, setEditing] = useState<LessonLearned | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const lessons = data.lessons.filter((lesson) => {
    if (status !== "All" && lesson.status !== status) return false;
    return (
      !search ||
      `${lesson.lesson} ${lesson.actionToApply || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Lessons Learned"
        subtitle="A library of useful patterns from reviews, check-ins, projects, and failures."
        action={
          <button
            className="btn-primary"
            onClick={() =>
              setEditing({
                id: "",
                lesson: "",
                status: "Active",
                createdAt: "",
                updatedAt: "",
              })
            }
          >
            Add Lesson
          </button>
        }
      />
      <section className="card grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          className="input"
          placeholder="Search lessons"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="input"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {["All", "Active", "Applied", "Archived"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          className="btn-secondary"
          onClick={() => exportLessonsMarkdown(data.lessons)}
        >
          Export Markdown
        </button>
      </section>
      <section className="space-y-3">
        {lessons.map((lesson) => (
          <article key={lesson.id} className="card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{lesson.lesson}</h3>
                  <span className="badge">{lesson.status}</span>
                  {lesson.sourceType ? (
                    <span className="badge">{lesson.sourceType}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                  Apply:{" "}
                  {lesson.actionToApply || "Keep visible during planning."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() => setEditing(lesson)}
                >
                  Edit
                </button>
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() =>
                    updateLesson(lesson.id, {
                      status: "Applied",
                      lastReviewedAt: new Date().toISOString(),
                    })
                  }
                >
                  Applied
                </button>
                <button
                  className="btn-secondary min-h-10 px-3"
                  onClick={() =>
                    updateLesson(lesson.id, { status: "Archived" })
                  }
                >
                  Archive
                </button>
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
            else
              addLesson({
                ...lesson,
                lesson: lesson.lesson || "Untitled lesson",
              });
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
  const [draft, setDraft] = useState<Partial<LessonLearned>>(
    lesson || { status: "Active", sourceType: "Manual" },
  );
  function set<K extends keyof LessonLearned>(key: K, value: LessonLearned[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return (
    <Modal title={lesson ? "Edit Lesson" : "Add Lesson"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft as Partial<LessonLearned> & { lesson?: string });
        }}
      >
        <Field label="Lesson">
          <textarea
            className="input"
            required
            value={draft.lesson || ""}
            onChange={(event) => set("lesson", event.target.value)}
          />
        </Field>
        <Field label="Action to apply">
          <input
            className="input"
            value={draft.actionToApply || ""}
            onChange={(event) => set("actionToApply", event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <CategorySelect
              categories={data.categories}
              value={draft.categoryId}
              onChange={(value) => set("categoryId", value)}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={draft.status || "Active"}
              onChange={(event) =>
                set("status", event.target.value as LessonLearned["status"])
              }
            >
              {["Active", "Applied", "Archived"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
        </div>
        <button className="btn-primary" type="submit">
          Save Lesson
        </button>
      </form>
    </Modal>
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
        <p className="mt-1 max-w-3xl text-sm text-ink-600 dark:text-ink-300">
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  );
}
