import type { AARReview, OpenLoop, Project } from "../types";
import { daysBetween, todayKey } from "./date";

const inactiveStatuses = new Set(["Done", "Dropped"]);

export function isLoopStale(loop: OpenLoop, thresholdDays: number): boolean {
  return (
    !loop.archivedAt &&
    !inactiveStatuses.has(loop.status) &&
    daysBetween(loop.lastTouchedAt) >= thresholdDays
  );
}

export function needsNextAction(loop: OpenLoop): boolean {
  return (
    !loop.archivedAt &&
    !inactiveStatuses.has(loop.status) &&
    !loop.nextAction?.trim() &&
    daysBetween(loop.createdAt) >= 3
  );
}

export function needsFollowUp(loop: OpenLoop): boolean {
  return (
    loop.status === "Waiting" &&
    Boolean(loop.followUpDate) &&
    loop.followUpDate! <= todayKey()
  );
}

export function isDueSoon(loop: OpenLoop): boolean {
  if (!loop.dueDate || inactiveStatuses.has(loop.status)) return false;
  const diff = daysBetween(new Date().toISOString(), new Date(`${loop.dueDate}T12:00:00`));
  return diff <= 7;
}

export function isProjectStale(project: Project, thresholdDays: number): boolean {
  if (project.status === "Archived") return false;
  return daysBetween(project.lastWorkedAt || project.updatedAt) >= thresholdDays;
}

export function suggestForLoop(loop: OpenLoop, thresholdDays: number): string {
  if (needsNextAction(loop)) return "Clarify the next visible action.";
  if (isLoopStale(loop, thresholdDays)) {
    return "Decide: do it, schedule it, delegate it, or drop it.";
  }
  if (needsFollowUp(loop)) return "Send the follow-up or choose a new waiting date.";
  return "Pick the smallest next action that moves it forward.";
}

export function suggestForProject(project: Project, thresholdDays: number): string {
  if (isProjectStale(project, thresholdDays)) {
    return "Archive it or define the next build step.";
  }
  return project.nextAction || "Name the next build step.";
}

export function suggestFromAAR(review: AARReview): string {
  if (review.wentWrong?.toLowerCase().includes("avoid")) {
    return "Create a 2-minute next action from what was avoided.";
  }
  return review.nextAction || "Turn one improve into a concrete next action.";
}
