import type { AARReview, AppData, LessonLearned } from "../types";
import { migrateData } from "../domain/data";
import { formatDate, todayKey, weekStartKey } from "./date";

function downloadText(
  filename: string,
  text: string,
  mime = "text/plain",
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDataJson(data: AppData): void {
  downloadText(
    `lifeops-backup-${todayKey()}.json`,
    JSON.stringify(data, null, 2),
    "application/json",
  );
}

export function importDataFromFile(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(migrateData(JSON.parse(String(reader.result))));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function section(title: string, value?: string): string {
  return value?.trim() ? `## ${title}\n\n${value.trim()}\n` : "";
}

export function aarToMarkdown(review: AARReview): string {
  const title =
    review.type === "Weekly"
      ? `# Weekly AAR - Week of ${formatDate(weekStartKey(new Date(`${review.date}T12:00:00`)))}`
      : `# ${review.title || `${review.type} AAR`}`;
  return [
    title,
    "",
    `Date: ${formatDate(review.date)}`,
    `Type: ${review.type}`,
    "",
    section("Intended Outcome", review.intendedOutcome),
    section("Actual Outcome", review.actualOutcome),
    section("Went Well", review.wentWell),
    section("Went Wrong Or Avoided", review.wentWrong),
    section("Sustains", review.sustain),
    section("Improves", review.improve),
    section("Next Actions", review.nextAction),
    review.tags.length ? `## Tags\n\n${review.tags.join(", ")}\n` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function exportAarMarkdown(review: AARReview): void {
  downloadText(
    `${review.title || "aar-review"}.md`,
    aarToMarkdown(review),
    "text/markdown",
  );
}

export function lessonsToMarkdown(lessons: LessonLearned[]): string {
  return [
    "# Lessons Learned",
    "",
    ...lessons.map((lesson) =>
      [
        `## ${lesson.lesson}`,
        lesson.actionToApply ? `Apply: ${lesson.actionToApply}` : "",
        `Status: ${lesson.status}`,
        lesson.sourceType ? `Source: ${lesson.sourceType}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
  ].join("\n\n");
}

export function exportLessonsMarkdown(lessons: LessonLearned[]): void {
  downloadText(
    "lifeops-lessons.md",
    lessonsToMarkdown(lessons),
    "text/markdown",
  );
}
