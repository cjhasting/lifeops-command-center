import type { AppData } from "../types";
export function createSeedData(): AppData {
  return {
    version: 6,
    categories: [],
    missions: [],
    openLoops: [],
    projects: [],
    aarReviews: [],
    lessons: [],
    habits: [],
    avoidanceCheckIns: [],
    notes: [],
    dayPlans: [],
    settings: {
      theme: "system",
      staleTaskDays: 14,
      staleProjectDays: 21,
      aiSuggestionsEnabled: false,
      minimumDayDefaults: [],
    },
  };
}
