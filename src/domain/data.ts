import type { AppData, DayPlan, OpenLoop, RepeatSetting } from "../types";
import { addDays, nowIso, todayKey, uid } from "../utils/date";
import { createSeedData } from "../data/seed";

const collections = [
  "categories",
  "missions",
  "openLoops",
  "projects",
  "aarReviews",
  "lessons",
  "habits",
  "avoidanceCheckIns",
] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid backup: ${message}`);
}
const strings = (x: unknown) =>
  Array.isArray(x) && x.every((v) => typeof v === "string");
export function migrateData(input: unknown): AppData {
  assert(input && typeof input === "object", "expected an object.");
  const d = input as AppData;
  assert(
    Number.isInteger(d.version) && d.version >= 1 && d.version <= 6,
    "unsupported version.",
  );
  for (const key of [
    ...collections,
    ...(d.version === 6 ? (["notes", "dayPlans"] as const) : []),
  ]) {
    assert(Array.isArray(d[key]), `${key} must be a list.`);
    const ids = new Set<string>();
    for (const item of d[key]) {
      assert(
        item && typeof item === "object",
        `${key} contains an invalid record.`,
      );
      const id = "id" in item ? item.id : item.date;
      assert(
        typeof id === "string" && id.length > 0 && !ids.has(id),
        `${key} contains a missing or duplicate ID.`,
      );
      ids.add(id);
    }
  }
  assert(
    d.settings && ["light", "dark", "system"].includes(d.settings.theme),
    "invalid settings.",
  );
  assert(
    strings(d.settings.minimumDayDefaults),
    "invalid minimum day defaults.",
  );
  for (const t of d.openLoops) {
    assert(
      typeof t.title === "string" &&
        [
          "Captured",
          "Next Action",
          "In Progress",
          "Waiting",
          "Scheduled",
          "Done",
          "Dropped",
        ].includes(t.status),
      "invalid task.",
    );
    assert(
      !t.repeat || ["None", "Daily", "Weekly", "Monthly"].includes(t.repeat),
      "invalid repeat setting.",
    );
    for (const k of [
      "dueDate",
      "followUpDate",
      "plannedDate",
      "completionDate",
    ] as const)
      assert(
        !t[k] ||
          (typeof t[k] === "string" &&
            ((k === "plannedDate" && t[k] === "someday") || validDate(t[k]!))),
        `invalid ${k}.`,
      );
  }
  for (const [list, field] of [
    [d.categories, "name"],
    [d.projects, "name"],
    [d.lessons, "lesson"],
    [d.habits, "name"],
    [d.aarReviews, "title"],
    [d.avoidanceCheckIns, "avoidedThing"],
  ] as const)
    for (const item of list)
      assert(
        typeof (item as unknown as Record<string, unknown>)[field] === "string",
        `invalid ${field}.`,
      );
  for (const m of d.missions)
    assert(
      validDate(m.date) && strings(m.topThree),
      "invalid historical mission.",
    );
  for (const r of d.aarReviews)
    assert(validDate(r.date) && strings(r.tags), "invalid review.");
  for (const h of d.habits)
    assert(strings(h.completedDates), "invalid habit history.");
  // Check every known scalar before it can reach React or date/repeat logic.
  const textFields = [
    "title",
    "name",
    "lesson",
    "focus",
    "nonNegotiable",
    "avoid",
    "notes",
    "nextAction",
    "minimumVersion",
    "currentObjective",
    "intendedOutcome",
    "actualOutcome",
    "wentWell",
    "wentWrong",
    "sustain",
    "improve",
    "actionToApply",
    "avoidedThing",
    "reason",
    "twoMinuteAction",
    "categoryId",
    "relatedProjectId",
    "relatedOpenLoopId",
    "sourceId",
    "sourceType",
    "sourceNoteId",
    "extractionKey",
    "recurrenceParentId",
    "nextActionId",
    "createdAt",
    "updatedAt",
    "lastTouchedAt",
    "lastWorkedAt",
    "completedAt",
    "archivedAt",
    "lastReviewedAt",
  ];
  for (const key of collections)
    for (const item of d[key])
      for (const field of textFields) {
        const value = (item as unknown as Record<string, unknown>)[field];
        assert(
          value === undefined || typeof value === "string",
          `${key}.${field} must be text.`,
        );
      }
  for (const p of d.projects) {
    assert(
      [
        "Idea",
        "Planning",
        "Building",
        "Revising",
        "Deployed",
        "Paused",
        "Archived",
      ].includes(p.status),
      "invalid project status.",
    );
    assert(
      p.links === undefined ||
        (Array.isArray(p.links) &&
          p.links.every(
            (l) =>
              l && typeof l.url === "string" && typeof l.label === "string",
          )),
      "invalid project links.",
    );
  }
  for (const r of d.aarReviews)
    assert(
      ["Daily", "Weekly", "Project", "Custom"].includes(r.type),
      "invalid review type.",
    );
  for (const h of d.habits)
    assert(
      typeof h.active === "boolean" &&
        (h.repeatDays === undefined || strings(h.repeatDays)),
      "invalid habit.",
    );
  for (const t of d.openLoops)
    assert(
      t.recurrenceDay === undefined ||
        (Number.isInteger(t.recurrenceDay) &&
          t.recurrenceDay >= 1 &&
          t.recurrenceDay <= 31),
      "invalid recurrence anchor.",
    );
  if (d.version === 6) {
    for (const n of d.notes) {
      assert(
        typeof n.text === "string" &&
          ["inbox", "note", "archived"].includes(n.state),
        "invalid note.",
      );
      for (const key of ["relatedProjectId", "createdAt", "updatedAt"] as const)
        assert(n[key] === undefined || typeof n[key] === "string", "invalid note metadata.");
    }
    for (const p of d.dayPlans) {
      assert(
        validDate(p.date) &&
          typeof p.lowEnergy === "boolean" &&
          strings(p.taskIds) &&
          p.taskIds.length <= 3 &&
          new Set(p.taskIds).size === p.taskIds.length,
        "invalid plan.",
      );
      assert(
        p.taskIds.every((id) => d.openLoops.some((t) => t.id === id)),
        "plan refers to a missing task.",
      );
      assert(
        Array.isArray(p.smallActions) && p.smallActions.length <= 3 &&
          new Set(p.smallActions.map((a) => a?.id)).size === p.smallActions.length,
        "invalid reduced plan.",
      );
      for (const a of p.smallActions)
        assert(
          a &&
            typeof a.id === "string" &&
            a.id.length > 0 &&
            (a.minimum === undefined || typeof a.minimum === "boolean") &&
            (a.text === undefined || typeof a.text === "string") &&
            (!a.minimum || typeof a.text === "string") &&
            (a.completedAt === undefined || typeof a.completedAt === "string") &&
            (a.taskId
              ? d.openLoops.some((t) => t.id === a.taskId)
              : typeof a.text === "string"),
          "invalid reduced action.",
        );
    }
  }
  if (d.version === 6) return structuredClone(d);
  // Preserve every old record verbatim. Only unambiguous exact matches become references.
  const dayPlans: DayPlan[] = [];
  for (const m of d.missions) {
    if (dayPlans.some((p) => p.date === m.date)) continue;
    const ids = m.topThree.flatMap((title) => {
      const matches = d.openLoops.filter((t) => t.title === title);
      return matches.length === 1 ? [matches[0].id] : [];
    });
    dayPlans.push({
      date: m.date,
      taskIds: [...new Set(ids)].slice(0, 3),
      lowEnergy: false,
      smallActions: [],
    });
  }
  return {
    ...createSeedData(),
    ...structuredClone(d),
    version: 6,
    notes: [],
    dayPlans,
  };
}
export function validDate(s: string) {
  return datePattern.test(s) && todayKey(new Date(`${s}T12:00:00`)) === s;
}
export const active = (t: OpenLoop) =>
  t.status !== "Done" && t.status !== "Dropped" && !t.archivedAt;
export function planFor(d: AppData, date: string): DayPlan {
  return (
    d.dayPlans.find((p) => p.date === date) || {
      date,
      taskIds: [],
      lowEnergy: false,
      smallActions: [],
    }
  );
}
export function setPlan(d: AppData, plan: DayPlan): AppData {
  return {
    ...d,
    dayPlans: [...d.dayPlans.filter((p) => p.date !== plan.date), plan],
  };
}
export function newTask(
  title: string,
  patch: Partial<OpenLoop> = {},
): OpenLoop {
  const now = nowIso();
  return {
    id: uid("task"),
    title,
    status: "Next Action",
    priority: "Medium",
    repeat: "None",
    createdAt: now,
    updatedAt: now,
    lastTouchedAt: now,
    ...patch,
  };
}
export function schedule(
  d: AppData,
  id: string,
  date: string,
  fromDate: string,
): AppData {
  return {
    ...d,
    openLoops: d.openLoops.map((t) =>
      t.id === id ? { ...t, plannedDate: date, updatedAt: nowIso() } : t,
    ),
    dayPlans: d.dayPlans.map((p) =>
      p.date === fromDate
        ? {
            ...p,
            taskIds: p.taskIds.filter((x) => x !== id),
            smallActions: p.smallActions.filter(
              (a) => a.taskId !== id || !!a.completedAt,
            ),
          }
        : p,
    ),
  };
}
export function nextOccurrence(
  date: string,
  repeat: RepeatSetting,
  anchor?: number,
): string {
  if (repeat === "Daily") return addDays(date, 1);
  if (repeat === "Weekly") return addDays(date, 7);
  const d = new Date(`${date}T12:00:00`);
  const day = anchor || d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return todayKey(d);
}
export function completeTask(
  d: AppData,
  id: string,
  date: string,
  done = true,
): AppData {
  const task = d.openLoops.find((t) => t.id === id);
  if (
    !task ||
    (done && task.status === "Done") ||
    (!done && task.status !== "Done")
  )
    return d;
  const now = nowIso();
  let tasks = d.openLoops.map((t) =>
    t.id === id
      ? {
          ...t,
          status: done
            ? ("Done" as const)
            : t.previousStatus || ("Next Action" as const),
          previousStatus: done ? t.status : t.previousStatus,
          completedAt: done ? now : undefined,
          completionDate: done ? date : undefined,
          updatedAt: now,
          lastTouchedAt: now,
        }
      : t,
  );
  if (
    done &&
    task.repeat &&
    task.repeat !== "None" &&
    !tasks.some((t) => t.recurrenceParentId === id)
  ) {
    const base =
      task.plannedDate && validDate(task.plannedDate)
        ? task.plannedDate
        : task.dueDate || date;
    const anchor = task.recurrenceDay || Number(base.slice(-2));
    let next = nextOccurrence(base, task.repeat, anchor);
    while (next <= date) next = nextOccurrence(next, task.repeat, anchor);
    tasks.push(
      newTask(task.title, {
        ...task,
        id: `${id}:next`,
        status: "Scheduled",
        completedAt: undefined,
        completionDate: undefined,
        previousStatus: undefined,
        recurrenceParentId: id,
        recurrenceDay: anchor,
        plannedDate: next,
        dueDate: task.dueDate ? next : undefined,
        followUpDate: undefined,
        createdAt: now,
        updatedAt: now,
        lastTouchedAt: now,
      }),
    );
  }
  // Keep the generated child on undo: re-completing cannot duplicate or erase edited work.
  return {
    ...d,
    openLoops: tasks,
    projects: d.projects.map((p) =>
      done && p.id === task.relatedProjectId
        ? { ...p, lastWorkedAt: now, updatedAt: now }
        : p,
    ),
  };
}
export function extractTasks(
  d: AppData,
  noteId: string,
  lines: { index: number; text: string }[],
): AppData {
  const note = d.notes.find((n) => n.id === noteId);
  if (!note) return d;
  const tasks = [...d.openLoops];
  for (const line of lines) {
    const key = `${noteId}:${line.index}`;
    if (line.text.trim() && !tasks.some((t) => t.extractionKey === key))
      tasks.push(
        newTask(line.text.trim(), {
          sourceNoteId: noteId,
          extractionKey: key,
          relatedProjectId: note.relatedProjectId,
        }),
      );
  }
  return {
    ...d,
    openLoops: tasks,
    notes: d.notes.map((n) => (n.id === noteId ? { ...n, state: "note" } : n)),
  };
}
export function saveWrap(
  d: AppData,
  date: string,
  note: string,
  first?: string,
): AppData {
  const existing = d.aarReviews.find(
    (r) => r.type === "Daily" && r.date === date,
  );
  const now = nowIso();
  const review = {
    ...existing,
    id: existing?.id || `wrap:${date}`,
    title: existing?.title || `Wrap up · ${date}`,
    type: "Daily" as const,
    date,
    tags: existing?.tags || [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    wentWell: note,
    actualOutcome: d.openLoops
      .filter((t) => t.completionDate === date)
      .map((t) => t.title)
      .join("\n"),
  };
  let next = {
    ...d,
    aarReviews: [...d.aarReviews.filter((r) => r.id !== review.id), review],
  };
  if (first) {
    const p = planFor(next, addDays(date, 1));
    next = setPlan(next, {
      ...p,
      taskIds: [first, ...p.taskIds.filter((id) => id !== first)].slice(0, 3),
    });
  }
  return next;
}
