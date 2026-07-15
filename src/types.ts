export type ThemeMode = "light" | "dark" | "system";
export type PageKey =
  | "dashboard"
  | "loops"
  | "projects"
  | "aars"
  | "lessons"
  | "settings";

export interface Category {
  id: string;
  name: string;
  color?: string;
  archived: boolean;
  createdAt: string;
}

export interface DailyMission {
  id: string;
  date: string;
  focus?: string;
  topThree: string[];
  nonNegotiable?: string;
  avoid?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpenLoopStatus =
  | "Captured"
  | "Next Action"
  | "In Progress"
  | "Waiting"
  | "Scheduled"
  | "Done"
  | "Dropped";

export type Priority = "Low" | "Medium" | "High";
export type RepeatSetting = "None" | "Daily" | "Weekly" | "Monthly";

export interface OpenLoop {
  id: string;
  title: string;
  categoryId?: string;
  status: OpenLoopStatus;
  priority: Priority;
  nextAction?: string;
  dueDate?: string;
  followUpDate?: string;
  repeat?: RepeatSetting;
  relatedProjectId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastTouchedAt: string;
  completedAt?: string;
  archivedAt?: string;
}

export type ProjectStatus =
  | "Idea"
  | "Planning"
  | "Building"
  | "Revising"
  | "Deployed"
  | "Paused"
  | "Archived";

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  categoryId?: string;
  status: ProjectStatus;
  currentObjective?: string;
  nextAction?: string;
  notes?: string;
  links?: ProjectLink[];
  createdAt: string;
  updatedAt: string;
  lastWorkedAt?: string;
  archivedAt?: string;
}

export type AARType = "Daily" | "Weekly" | "Project" | "Custom";

export interface AARReview {
  id: string;
  title: string;
  type: AARType;
  date: string;
  categoryId?: string;
  relatedProjectId?: string;
  relatedOpenLoopId?: string;
  intendedOutcome?: string;
  actualOutcome?: string;
  wentWell?: string;
  wentWrong?: string;
  sustain?: string;
  improve?: string;
  nextAction?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type LessonSourceType =
  | "AAR"
  | "Avoidance Check-In"
  | "Project"
  | "Manual";
export type LessonStatus = "Active" | "Applied" | "Archived";

export interface LessonLearned {
  id: string;
  lesson: string;
  categoryId?: string;
  sourceType?: LessonSourceType;
  sourceId?: string;
  actionToApply?: string;
  status: LessonStatus;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

export interface Habit {
  id: string;
  name: string;
  categoryId?: string;
  minimumVersion?: string;
  targetPerWeek?: number;
  repeatDays?: string[];
  completedDates: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvoidanceCheckIn {
  id: string;
  date: string;
  avoidedThing: string;
  reason?: string;
  twoMinuteAction?: string;
  categoryId?: string;
  relatedOpenLoopId?: string;
  relatedProjectId?: string;
  createdAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
  staleTaskDays: number;
  staleProjectDays: number;
  aiSuggestionsEnabled: boolean;
  minimumDayDefaults: string[];
}

export interface AppData {
  version: number;
  categories: Category[];
  missions: DailyMission[];
  openLoops: OpenLoop[];
  projects: Project[];
  aarReviews: AARReview[];
  lessons: LessonLearned[];
  habits: Habit[];
  avoidanceCheckIns: AvoidanceCheckIn[];
  settings: AppSettings;
}

export type QuickAddKind =
  | "Open Loop"
  | "Project"
  | "AAR"
  | "Lesson"
  | "Avoidance Check-In"
  | "Habit";
