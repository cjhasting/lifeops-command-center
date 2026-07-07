import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSeedData } from "../data/seed";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "../storage/localDb";
import type {
  AARReview,
  AppData,
  AppSettings,
  AvoidanceCheckIn,
  Category,
  DailyMission,
  Habit,
  LessonLearned,
  OpenLoop,
  Project,
} from "../types";
import { nowIso, todayKey, uid } from "../utils/date";

type CollectionName =
  | "categories"
  | "missions"
  | "openLoops"
  | "projects"
  | "aarReviews"
  | "lessons"
  | "habits"
  | "avoidanceCheckIns";

interface LifeOpsContextValue {
  data: AppData;
  ready: boolean;
  replaceData: (next: AppData) => void;
  resetData: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  upsertMission: (mission: Partial<DailyMission>) => DailyMission;
  addOpenLoop: (loop: Partial<OpenLoop> & Pick<OpenLoop, "title">) => OpenLoop;
  updateOpenLoop: (id: string, patch: Partial<OpenLoop>) => void;
  addProject: (project: Partial<Project> & Pick<Project, "name">) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addAAR: (review: Partial<AARReview> & Pick<AARReview, "title" | "type">) => AARReview;
  updateAAR: (id: string, patch: Partial<AARReview>) => void;
  addLesson: (
    lesson: Partial<LessonLearned> & Pick<LessonLearned, "lesson">,
  ) => LessonLearned;
  updateLesson: (id: string, patch: Partial<LessonLearned>) => void;
  addHabit: (habit: Partial<Habit> & Pick<Habit, "name">) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  addAvoidance: (
    checkIn: Partial<AvoidanceCheckIn> & Pick<AvoidanceCheckIn, "avoidedThing">,
  ) => AvoidanceCheckIn;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  addCategory: (name: string) => Category;
  removeItem: (collection: CollectionName, id: string) => void;
}

const LifeOpsContext = createContext<LifeOpsContextValue | null>(null);

function withTimestamp<T extends { updatedAt?: string }>(item: T): T {
  return { ...item, updatedAt: nowIso() };
}

export function LifeOpsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => createSeedData());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSnapshot().then((snapshot) => {
      setData(snapshot || createSeedData());
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) void saveSnapshot(data);
  }, [data, ready]);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = data.settings.theme === "dark" || (data.settings.theme === "system" && prefersDark);
    root.classList.toggle("dark", dark);
  }, [data.settings.theme]);

  const mutate = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => updater(current));
  }, []);

  const replaceData = useCallback((next: AppData) => {
    setData(next);
  }, []);

  const resetData = useCallback(async () => {
    await clearSnapshot();
    setData(createSeedData());
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      mutate((current) => ({
        ...current,
        settings: { ...current.settings, ...patch },
      }));
    },
    [mutate],
  );

  const upsertMission = useCallback(
    (mission: Partial<DailyMission>): DailyMission => {
      const now = nowIso();
      const date = mission.date || todayKey();
      const existingId =
        mission.id || data.missions.find((item) => item.date === date)?.id;
      const nextMission: DailyMission = {
        id: existingId || uid("mission"),
        date,
        focus: mission.focus,
        topThree: mission.topThree || [],
        nonNegotiable: mission.nonNegotiable,
        avoid: mission.avoid,
        notes: mission.notes,
        createdAt:
          data.missions.find((item) => item.id === existingId)?.createdAt || now,
        updatedAt: now,
      };
      mutate((current) => ({
        ...current,
        missions: existingId
          ? current.missions.map((item) =>
              item.id === existingId ? nextMission : item,
            )
          : [nextMission, ...current.missions],
      }));
      return nextMission;
    },
    [data.missions, mutate],
  );

  const addOpenLoop = useCallback(
    (loop: Partial<OpenLoop> & Pick<OpenLoop, "title">): OpenLoop => {
      const now = nowIso();
      const next: OpenLoop = {
        id: uid("loop"),
        title: loop.title,
        categoryId: loop.categoryId,
        status: loop.status || "Captured",
        priority: loop.priority || "Medium",
        nextAction: loop.nextAction,
        dueDate: loop.dueDate,
        followUpDate: loop.followUpDate,
        repeat: loop.repeat || "None",
        relatedProjectId: loop.relatedProjectId,
        notes: loop.notes,
        createdAt: now,
        updatedAt: now,
        lastTouchedAt: now,
      };
      mutate((current) => ({ ...current, openLoops: [next, ...current.openLoops] }));
      return next;
    },
    [mutate],
  );

  const updateOpenLoop = useCallback(
    (id: string, patch: Partial<OpenLoop>) => {
      mutate((current) => ({
        ...current,
        openLoops: current.openLoops.map((item) =>
          item.id === id ? withTimestamp({ ...item, ...patch, lastTouchedAt: nowIso() }) : item,
        ),
      }));
    },
    [mutate],
  );

  const addProject = useCallback(
    (project: Partial<Project> & Pick<Project, "name">): Project => {
      const now = nowIso();
      const next: Project = {
        id: uid("project"),
        name: project.name,
        categoryId: project.categoryId,
        status: project.status || "Idea",
        currentObjective: project.currentObjective,
        nextAction: project.nextAction,
        notes: project.notes,
        links: project.links || [],
        createdAt: now,
        updatedAt: now,
        lastWorkedAt: project.lastWorkedAt || now,
      };
      mutate((current) => ({ ...current, projects: [next, ...current.projects] }));
      return next;
    },
    [mutate],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      mutate((current) => ({
        ...current,
        projects: current.projects.map((item) =>
          item.id === id ? withTimestamp({ ...item, ...patch }) : item,
        ),
      }));
    },
    [mutate],
  );

  const addAAR = useCallback(
    (review: Partial<AARReview> & Pick<AARReview, "title" | "type">): AARReview => {
      const now = nowIso();
      const next: AARReview = {
        id: uid("aar"),
        title: review.title,
        type: review.type,
        date: review.date || todayKey(),
        categoryId: review.categoryId,
        relatedProjectId: review.relatedProjectId,
        relatedOpenLoopId: review.relatedOpenLoopId,
        intendedOutcome: review.intendedOutcome,
        actualOutcome: review.actualOutcome,
        wentWell: review.wentWell,
        wentWrong: review.wentWrong,
        sustain: review.sustain,
        improve: review.improve,
        nextAction: review.nextAction,
        tags: review.tags || [],
        createdAt: now,
        updatedAt: now,
      };
      mutate((current) => ({ ...current, aarReviews: [next, ...current.aarReviews] }));
      return next;
    },
    [mutate],
  );

  const updateAAR = useCallback(
    (id: string, patch: Partial<AARReview>) => {
      mutate((current) => ({
        ...current,
        aarReviews: current.aarReviews.map((item) =>
          item.id === id ? withTimestamp({ ...item, ...patch }) : item,
        ),
      }));
    },
    [mutate],
  );

  const addLesson = useCallback(
    (lesson: Partial<LessonLearned> & Pick<LessonLearned, "lesson">): LessonLearned => {
      const now = nowIso();
      const next: LessonLearned = {
        id: uid("lesson"),
        lesson: lesson.lesson,
        categoryId: lesson.categoryId,
        sourceType: lesson.sourceType || "Manual",
        sourceId: lesson.sourceId,
        actionToApply: lesson.actionToApply,
        status: lesson.status || "Active",
        createdAt: now,
        updatedAt: now,
        lastReviewedAt: lesson.lastReviewedAt,
      };
      mutate((current) => ({ ...current, lessons: [next, ...current.lessons] }));
      return next;
    },
    [mutate],
  );

  const updateLesson = useCallback(
    (id: string, patch: Partial<LessonLearned>) => {
      mutate((current) => ({
        ...current,
        lessons: current.lessons.map((item) =>
          item.id === id ? withTimestamp({ ...item, ...patch }) : item,
        ),
      }));
    },
    [mutate],
  );

  const addHabit = useCallback(
    (habit: Partial<Habit> & Pick<Habit, "name">): Habit => {
      const now = nowIso();
      const next: Habit = {
        id: uid("habit"),
        name: habit.name,
        categoryId: habit.categoryId,
        minimumVersion: habit.minimumVersion,
        targetPerWeek: habit.targetPerWeek,
        repeatDays: habit.repeatDays || [],
        completedDates: habit.completedDates || [],
        active: habit.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
      mutate((current) => ({ ...current, habits: [next, ...current.habits] }));
      return next;
    },
    [mutate],
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Habit>) => {
      mutate((current) => ({
        ...current,
        habits: current.habits.map((item) =>
          item.id === id ? withTimestamp({ ...item, ...patch }) : item,
        ),
      }));
    },
    [mutate],
  );

  const addAvoidance = useCallback(
    (
      checkIn: Partial<AvoidanceCheckIn> & Pick<AvoidanceCheckIn, "avoidedThing">,
    ): AvoidanceCheckIn => {
      const now = nowIso();
      const next: AvoidanceCheckIn = {
        id: uid("avoid"),
        date: checkIn.date || todayKey(),
        avoidedThing: checkIn.avoidedThing,
        reason: checkIn.reason,
        twoMinuteAction: checkIn.twoMinuteAction,
        categoryId: checkIn.categoryId,
        relatedOpenLoopId: checkIn.relatedOpenLoopId,
        relatedProjectId: checkIn.relatedProjectId,
        createdAt: now,
      };
      mutate((current) => ({
        ...current,
        avoidanceCheckIns: [next, ...current.avoidanceCheckIns],
      }));
      return next;
    },
    [mutate],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) => {
      mutate((current) => ({
        ...current,
        categories: current.categories.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
    },
    [mutate],
  );

  const addCategory = useCallback(
    (name: string): Category => {
      const next: Category = {
        id: uid("cat"),
        name,
        archived: false,
        createdAt: nowIso(),
      };
      mutate((current) => ({ ...current, categories: [...current.categories, next] }));
      return next;
    },
    [mutate],
  );

  const removeItem = useCallback(
    (collection: CollectionName, id: string) => {
      mutate((current) => ({
        ...current,
        [collection]: current[collection].filter((item) => item.id !== id),
      }));
    },
    [mutate],
  );

  const value = useMemo(
    () => ({
      data,
      ready,
      replaceData,
      resetData,
      updateSettings,
      upsertMission,
      addOpenLoop,
      updateOpenLoop,
      addProject,
      updateProject,
      addAAR,
      updateAAR,
      addLesson,
      updateLesson,
      addHabit,
      updateHabit,
      addAvoidance,
      updateCategory,
      addCategory,
      removeItem,
    }),
    [
      addAAR,
      addAvoidance,
      addCategory,
      addHabit,
      addLesson,
      addOpenLoop,
      addProject,
      data,
      ready,
      removeItem,
      replaceData,
      resetData,
      updateAAR,
      updateCategory,
      updateHabit,
      updateLesson,
      updateOpenLoop,
      updateProject,
      updateSettings,
      upsertMission,
    ],
  );

  return <LifeOpsContext.Provider value={value}>{children}</LifeOpsContext.Provider>;
}

export function useLifeOps(): LifeOpsContextValue {
  const value = useContext(LifeOpsContext);
  if (!value) throw new Error("useLifeOps must be used inside LifeOpsProvider");
  return value;
}
