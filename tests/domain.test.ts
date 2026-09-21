import { describe, it, expect, vi, afterEach } from "vitest";
import { createSeedData } from "../src/data/seed";
import {
  completeTask,
  extractTasks,
  migrateData,
  newTask,
  nextOccurrence,
  planFor,
  saveWrap,
  schedule,
  setPlan,
} from "../src/domain/data";
import { addDays, todayKey } from "../src/utils/date";
import {
  loadSnapshot,
  saveSnapshot,
  DATA_KEY,
  RECOVERY_KEY,
} from "../src/storage/localDb";
const fixture = () => {
  const d = createSeedData();
  d.openLoops = [
    newTask("Walk", {
      id: "walk",
      minimumVersion: "Put on shoes",
      dueDate: "2026-10-05",
      relatedProjectId: "p",
    }),
    newTask("Measure garage", { id: "measure" }),
  ];
  d.projects = [
    {
      id: "p",
      name: "Health",
      status: "Building",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ];
  return setPlan(d, {
    date: "2026-09-20",
    taskIds: ["walk", "measure"],
    lowEnergy: false,
    smallActions: [],
  });
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("versioned migration", () => {
  it("preserves records, unknown fields, IDs and ambiguous historical text without manufacturing tasks", () => {
    const old = {
      ...fixture(),
      version: 5,
      finance: { keep: "historic" },
      missions: [
        {
          id: "m",
          date: "2026-09-20",
          topThree: ["Walk", "Unmatched"],
          createdAt: "x",
          updatedAt: "x",
        },
      ],
      habits: [
        {
          id: "h",
          name: "Water",
          active: true,
          completedDates: ["2026-09-19"],
          createdAt: "x",
          updatedAt: "x",
        },
      ],
      lessons: [
        {
          id: "l",
          lesson: "Learn",
          status: "Active",
          createdAt: "x",
          updatedAt: "x",
        },
      ],
    };
    const migrated = migrateData(old);
    expect(migrated.openLoops).toEqual(old.openLoops);
    expect(migrated.missions).toEqual(old.missions);
    expect(migrated.habits).toEqual(old.habits);
    expect(migrated.lessons).toEqual(old.lessons);
    expect(migrated).toHaveProperty("finance", old.finance);
    expect(migrated.dayPlans[0].taskIds).toEqual(["walk"]);
    expect(migrateData(migrated)).toEqual(migrated);
    old.openLoops.push(newTask("Walk"));
    expect(migrateData(old).dayPlans[0].taskIds).toEqual([]);
  });
  it("round trips every new record", () => {
    const d = fixture();
    d.notes = [
      {
        id: "n",
        text: "hello\nworld",
        state: "note",
        createdAt: "x",
        updatedAt: "x",
      },
    ];
    d.dayPlans[0].lowEnergy = true;
    d.dayPlans[0].smallActions = [
      {
        id: "s",
        taskId: "walk",
        minimum: true,
        text: "Shoes",
        completedAt: "x",
      },
    ];
    expect(migrateData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it("rejects malformed reduced-plan text before it can reach the interface", () => {
    const d = fixture();
    const malformed = JSON.parse(JSON.stringify(d));
    malformed.dayPlans[0].smallActions = [{ id: "s", taskId: "walk", minimum: true, text: {} }];
    expect(() => migrateData(malformed)).toThrow("invalid reduced action");
    expect(d.dayPlans[0].smallActions).toEqual([]);
  });
  it.each([
    null,
    {},
    { version: 99 },
    { ...fixture(), notes: "wrong" },
    { ...fixture(), openLoops: [{ id: "x", title: 9, status: "Done" }] },
    {
      ...fixture(),
      dayPlans: [
        { date: "2026-02-30", taskIds: [], lowEnergy: false, smallActions: [] },
      ],
    },
  ])("rejects malformed backups", (value) =>
    expect(() => migrateData(value)).toThrow(),
  );
  it("saves recovery before replacing old data and is stable on reload", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    const old = { ...fixture(), version: 5 };
    values.set("lifeops:fallback", JSON.stringify(old));
    const first = await loadSnapshot();
    expect(JSON.parse(values.get(RECOVERY_KEY)!)).toEqual(old);
    expect(await loadSnapshot()).toEqual(first);
    expect(values.has(DATA_KEY)).toBe(true);
  });
  it("never overwrites a corrupt existing backup or falls back to seeds", async () => {
    const writes = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => "{broken",
      setItem: writes,
    });
    await expect(loadSnapshot()).rejects.toThrow();
    expect(writes).not.toHaveBeenCalled();
  });
  it("reports write failure", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    });
    expect(() => saveSnapshot(fixture())).toThrow("Quota exceeded");
  });
});
describe("shared state transitions", () => {
  it("completes same referenced task and updates project; repeated done is idempotent and undo restores it", () => {
    const d = fixture();
    const done = completeTask(d, "walk", "2026-09-20");
    expect(done.openLoops[0].status).toBe("Done");
    expect(planFor(done, "2026-09-20").taskIds[0]).toBe("walk");
    expect(done.projects[0].lastWorkedAt).toBeTruthy();
    expect(completeTask(done, "walk", "2026-09-20")).toBe(done);
    expect(
      completeTask(done, "walk", "2026-09-20", false).openLoops[0].status,
    ).toBe("Next Action");
  });
  it("postpones planned work without shifting deadline and retains historical plans", () => {
    const d = fixture();
    d.dayPlans.push({ ...d.dayPlans[0], date: "2026-09-19" });
    const next = schedule(d, "walk", "2026-09-24", "2026-09-20");
    expect(next.openLoops[0].dueDate).toBe("2026-10-05");
    expect(next.openLoops[0].plannedDate).toBe("2026-09-24");
    expect(next.dayPlans[0].taskIds).not.toContain("walk");
    expect(next.dayPlans[1].taskIds).toContain("walk");
  });
  it("keeps minimum progress separate and low energy local to its date", () => {
    const d = fixture();
    const p = planFor(d, "2026-09-20");
    const low = setPlan(d, {
      ...p,
      lowEnergy: true,
      smallActions: [
        {
          id: "s",
          taskId: "walk",
          minimum: true,
          text: "Shoes",
          completedAt: "now",
        },
      ],
    });
    expect(low.openLoops[0].status).toBe("Next Action");
    expect(planFor(low, "2026-09-21").lowEnergy).toBe(false);
    expect(
      setPlan(low, { ...planFor(low, "2026-09-20"), lowEnergy: false })
        .dayPlans[0].smallActions[0].completedAt,
    ).toBe("now");
  });
  it("retains completed minimum progress when the parent is postponed", () => {
    const d = fixture();
    d.dayPlans[0].smallActions = [{ id: "s", taskId: "walk", minimum: true, text: "Shoes", completedAt: "done" }];
    const next = schedule(d, "walk", "2026-09-21", "2026-09-20");
    expect(next.dayPlans[0].smallActions[0].completedAt).toBe("done");
    expect(next.openLoops[0].status).toBe("Next Action");
  });
  it("extracts only selected lines once even when wording is edited on resubmission", () => {
    const d = fixture();
    d.notes = [
      {
        id: "n",
        text: "Garage is a mess.\nNeed shelves.\nCheck measurements before buying.",
        state: "note",
        createdAt: "x",
        updatedAt: "x",
      },
    ];
    const first = extractTasks(d, "n", [
      { index: 2, text: "Measure garage wall" },
    ]);
    const twice = extractTasks(first, "n", [
      { index: 2, text: "Renamed line" },
    ]);
    expect(twice.openLoops).toHaveLength(3);
    expect(twice.notes[0].text).toBe(d.notes[0].text);
    expect(twice.openLoops[2].sourceNoteId).toBe("n");
  });
  it("upserts daily wrap-up while preserving longer review fields", () => {
    const d = fixture();
    let next = saveWrap(d, "2026-09-20", "Remember", "walk");
    next.aarReviews[0].improve = "Keep me";
    next = saveWrap(next, "2026-09-20", "Changed", "walk");
    expect(next.aarReviews).toHaveLength(1);
    expect(next.aarReviews[0].improve).toBe("Keep me");
    expect(next.aarReviews[0].wentWell).toBe("Changed");
    expect(planFor(next, "2026-09-21").taskIds).toEqual(["walk"]);
  });
});
describe("local dates and recurrence", () => {
  it("uses local calendar dates, not UTC", () => {
    const local = new Date(2026, 8, 20, 23, 59);
    expect(todayKey(local)).toBe("2026-09-20");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("clamps month ends and returns to the original day", () => {
    expect(nextOccurrence("2026-01-31", "Monthly", 31)).toBe("2026-02-28");
    expect(nextOccurrence("2026-02-28", "Monthly", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2028-01-31", "Monthly", 31)).toBe("2028-02-29");
    expect(nextOccurrence("2026-09-20", "Weekly")).toBe("2026-09-27");
  });
  it("generates one upcoming occurrence; undo/recomplete does not duplicate it", () => {
    const d = fixture();
    d.openLoops[0].repeat = "Daily";
    d.openLoops[0].plannedDate = "2026-09-01";
    let next = completeTask(d, "walk", "2026-09-20");
    expect(next.openLoops[2].plannedDate).toBe("2026-09-21");
    next = completeTask(next, "walk", "2026-09-20", false);
    next = completeTask(next, "walk", "2026-09-20");
    expect(next.openLoops).toHaveLength(3);
  });
});
