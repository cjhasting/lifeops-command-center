import type { AppData, Category } from "../types";
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
    version: 5,
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
