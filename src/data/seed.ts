import type { AppData, Category, FinancialData } from "../types";
import { addDays, nowIso, todayKey, uid } from "../utils/date";

const categoryNames = [
  "Fitness",
  "House",
  "Money",
  "Family",
  "Work",
  "Projects",
  "Learning",
  "Admin",
  "Relationships",
];

const colors = [
  "#14b8a6",
  "#0ea5e9",
  "#f59e0b",
  "#f43f5e",
  "#64748b",
  "#8b5cf6",
  "#22c55e",
  "#eab308",
  "#ef4444",
];

export function createSeedData(): AppData {
  const now = nowIso();
  const categories: Category[] = categoryNames.map((name, index) => ({
    id: uid("cat"),
    name,
    color: colors[index],
    archived: false,
    createdAt: now,
  }));

  const category = (name: string) => categories.find((item) => item.name === name)?.id;

  return {
    version: 2,
    categories,
    missions: [
      {
        id: uid("mission"),
        date: todayKey(),
        focus: "Get organized and move the right things forward.",
        topThree: [
          "Finish app revision",
          "Work out or complete minimum version",
          "Handle one house/admin task",
        ],
        nonNegotiable: "10-minute walk",
        avoid: "Scrolling after 9 PM",
        createdAt: now,
        updatedAt: now,
      },
    ],
    openLoops: [
      {
        id: uid("loop"),
        title: "Review weekly priorities",
        categoryId: category("Admin"),
        status: "Next Action",
        priority: "High",
        nextAction: "Pick the three outcomes that matter this week.",
        dueDate: addDays(todayKey(), 2),
        repeat: "Weekly",
        createdAt: now,
        updatedAt: now,
        lastTouchedAt: now,
      },
      {
        id: uid("loop"),
        title: "Complete one workout or minimum version",
        categoryId: category("Fitness"),
        status: "Next Action",
        priority: "Medium",
        nextAction: "Walk for 10 minutes if a full workout is not happening.",
        repeat: "Daily",
        createdAt: now,
        updatedAt: now,
        lastTouchedAt: now,
      },
      {
        id: uid("loop"),
        title: "Work on active project for 20 minutes",
        categoryId: category("Projects"),
        status: "In Progress",
        priority: "High",
        nextAction: "Open the current build and make one focused improvement.",
        repeat: "Daily",
        createdAt: now,
        updatedAt: now,
        lastTouchedAt: now,
      },
    ],
    projects: [
      {
        id: uid("project"),
        name: "LifeOps Command Center",
        categoryId: category("Projects"),
        status: "Building",
        currentObjective: "Create a low-friction local-first command dashboard.",
        nextAction: "Use the dashboard for one real day and note friction.",
        notes: "Keep Version 1 practical and light.",
        links: [],
        createdAt: now,
        updatedAt: now,
        lastWorkedAt: now,
      },
    ],
    aarReviews: [],
    lessons: [
      {
        id: uid("lesson"),
        lesson: "If a task has no next action, it is not ready to execute.",
        categoryId: category("Admin"),
        sourceType: "Manual",
        actionToApply: "Clarify the next visible action before choosing the task.",
        status: "Active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    habits: [
      {
        id: uid("habit"),
        name: "10-minute walk",
        categoryId: category("Fitness"),
        minimumVersion: "Put on shoes and walk for 10 minutes.",
        targetPerWeek: 5,
        repeatDays: [],
        completedDates: [],
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    avoidanceCheckIns: [],
    finance: createFinanceSeedData(),
    settings: {
      theme: "system",
      staleTaskDays: 14,
      staleProjectDays: 21,
      aiSuggestionsEnabled: false,
      minimumDayDefaults: [
        "Drink water",
        "Move for 10 minutes",
        "Clear one surface or complete one small reset task",
        "Handle one open loop or choose tomorrow's first task",
        "Do a short end-of-day review",
      ],
    },
  };
}

export function createFinanceSeedData(): FinancialData {
  const now = nowIso();
  const tspId = uid("acct");
  const rothIraId = uid("acct");
  const brokerageId = uid("acct");

  return {
    mission:
      "Build enough wealth that work becomes optional while living a life I enjoy today.",
    principles: [
      "Automate decisions and remove friction.",
      "Use low-cost diversified index funds as the default.",
      "Never time the market or panic sell.",
      "Increase investments as income rises.",
      "Keep the system simple enough to use for decades.",
    ],
    priorityOrder: [
      "Cover essential expenses.",
      "Build and protect the emergency fund.",
      "Contribute to Roth TSP.",
      "Max Roth IRA when eligible.",
      "Invest additional dollars in brokerage.",
      "Consider extra mortgage payments only when aligned with larger goals.",
    ],
    accounts: [
      {
        id: tspId,
        name: "Roth TSP",
        type: "TSP",
        balance: 0,
        annualContribution: 0,
        targetRole: "Tax-advantaged retirement base.",
        updatedAt: now,
      },
      {
        id: rothIraId,
        name: "Roth IRA",
        type: "Roth IRA",
        balance: 0,
        annualContribution: 0,
        annualLimit: 7000,
        targetRole: "Max annually when eligible.",
        updatedAt: now,
      },
      {
        id: brokerageId,
        name: "Brokerage",
        type: "Brokerage",
        balance: 0,
        annualContribution: 0,
        targetRole: "Financial independence bridge before traditional retirement.",
        updatedAt: now,
      },
      {
        id: uid("acct"),
        name: "Emergency Fund",
        type: "Savings",
        balance: 0,
        targetRole: "Cash buffer before extra investing.",
        updatedAt: now,
      },
      {
        id: uid("acct"),
        name: "Home Equity",
        type: "Home Equity",
        balance: 0,
        targetRole: "Long-term net worth component.",
        updatedAt: now,
      },
      {
        id: uid("acct"),
        name: "Debts",
        type: "Debt",
        balance: 0,
        targetRole: "Subtract from net worth.",
        updatedAt: now,
      },
    ],
    holdings: [
      {
        id: uid("hold"),
        accountId: tspId,
        symbol: "C",
        name: "C Fund",
        category: "C Fund",
        value: 0,
        targetPercent: 70,
        updatedAt: now,
      },
      {
        id: uid("hold"),
        accountId: tspId,
        symbol: "I",
        name: "I Fund",
        category: "I Fund",
        value: 0,
        targetPercent: 20,
        updatedAt: now,
      },
      {
        id: uid("hold"),
        accountId: tspId,
        symbol: "S",
        name: "S Fund",
        category: "S Fund",
        value: 0,
        targetPercent: 10,
        updatedAt: now,
      },
      {
        id: uid("hold"),
        accountId: rothIraId,
        symbol: "SCHB",
        name: "Schwab U.S. Broad Market ETF",
        category: "SCHB",
        value: 0,
        targetPercent: 100,
        updatedAt: now,
      },
      {
        id: uid("hold"),
        accountId: brokerageId,
        symbol: "SCHB",
        name: "Schwab U.S. Broad Market ETF",
        category: "SCHB",
        value: 0,
        targetPercent: 80,
        updatedAt: now,
      },
      {
        id: uid("hold"),
        accountId: brokerageId,
        symbol: "STOCKS",
        name: "Individual Stocks",
        category: "Individual Stocks",
        value: 0,
        targetPercent: 20,
        updatedAt: now,
      },
    ],
    assumptions: {
      targetFiNumber: 1000000,
      emergencyFundTarget: 15000,
      annualInvestment: 12000,
      expectedAnnualReturn: 0.07,
      retirementAge: 60,
      pensionMonthly: 0,
      socialSecurityMonthly: 0,
    },
    quarterlyChecklist: [
      { id: uid("review"), label: "Update balances for every account.", completed: false },
      { id: uid("review"), label: "Confirm Roth IRA progress toward annual max.", completed: false },
      { id: uid("review"), label: "Review TSP allocation against 70 C / 20 I / 10 S.", completed: false },
      { id: uid("review"), label: "Check brokerage individual stocks stay at or below 20%.", completed: false },
      { id: uid("review"), label: "Review beneficiaries and insurance once this year.", completed: false },
      { id: uid("review"), label: "Update net worth and FI countdown.", completed: false },
      { id: uid("review"), label: "Capture one financial AAR lesson or adjustment.", completed: false },
    ],
  };
}
