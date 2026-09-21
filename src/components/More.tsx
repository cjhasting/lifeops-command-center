import { useState } from "react";
import { useLifeOps } from "../state/LifeOpsContext";
import { AARPage, LessonsPage, AvoidanceModal } from "../Legacy";
import { exportDataJson, importDataFromFile } from "../utils/exporters";
import { nowIso, uid } from "../utils/date";
import { Field } from "./Sheet";
export function More({ date }: { date: string }) {
  const { data, commit, replaceData, addAvoidance } = useLifeOps();
  const [view, setView] = useState("More");
  const [error, setError] = useState("");
  const [habit, setHabit] = useState("");
  const [category, setCategory] = useState("");
  const [avoid, setAvoid] = useState(false);
  if (view === "Reviews")
    return (
      <>
        <button className="quiet back" onClick={() => setView("More")}>
          ← More
        </button>
        <AARPage />
      </>
    );
  if (view === "Lessons")
    return (
      <>
        <button className="quiet back" onClick={() => setView("More")}>
          ← More
        </button>
        <LessonsPage />
      </>
    );
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Your space, your way</p>
        <h1>
          More<span className="heading-dot">.</span>
        </h1>
      </div>
      <div className="menu-list">
        <button onClick={() => setView("Reviews")}>
          Detailed reviews <span>→</span>
        </button>
        <button onClick={() => setView("Lessons")}>
          Lessons <span>→</span>
        </button>
      </div>
      <section className="project-section">
        <h2>Appearance</h2>
        <Field label="Theme">
          <select
            value={data.settings.theme}
            onChange={(e) =>
              commit((d) => ({
                ...d,
                settings: {
                  ...d.settings,
                  theme: e.target.value as "light" | "dark" | "system",
                },
              }))
            }
          >
            {["system", "light", "dark"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </section>
      <details className="section-details">
        <summary>Habits</summary>
        {data.habits.map((h) => (
          <div className="habit-row" key={h.id}>
            <label className="choice">
              <input
                type="checkbox"
                checked={h.completedDates.includes(date)}
                onChange={() =>
                  commit((d) => ({
                    ...d,
                    habits: d.habits.map((x) =>
                      x.id === h.id
                        ? {
                            ...x,
                            completedDates: x.completedDates.includes(date)
                              ? x.completedDates.filter((v) => v !== date)
                              : [...x.completedDates, date],
                          }
                        : x,
                    ),
                  }))
                }
              />
              <span>
                {h.name}
                {h.minimumVersion && <small>{h.minimumVersion}</small>}
              </span>
            </label>
            <button
              className="quiet"
              onClick={() =>
                commit((d) => ({
                  ...d,
                  habits: d.habits.map((x) =>
                    x.id === h.id ? { ...x, active: !x.active } : x,
                  ),
                }))
              }
            >
              {h.active ? "Pause" : "Resume"}
            </button>
          </div>
        ))}
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              commit((d) => ({
                ...d,
                habits: [
                  ...d.habits,
                  {
                    id: uid("habit"),
                    name: habit,
                    active: true,
                    completedDates: [],
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                  },
                ],
              }))
            )
              setHabit("");
          }}
        >
          <Field label="New habit">
            <input
              required
              value={habit}
              onChange={(e) => setHabit(e.target.value)}
            />
          </Field>
          <button className="secondary">Add habit</button>
        </form>
      </details>
      <details className="section-details">
        <summary>History & check-ins</summary>
        <button className="secondary" onClick={() => setAvoid(true)}>
          Add a check-in
        </button>
        {data.avoidanceCheckIns.map((a) => (
          <article key={a.id} className="history-entry">
            <h3>{a.avoidedThing}</h3>
            <p>
              {a.date} · {a.reason}
            </p>
            <p>{a.twoMinuteAction}</p>
          </article>
        ))}
        {data.missions.map((m) => (
          <article className="history-entry" key={m.id}>
            <h3>{m.date}</h3>
            <p>{m.focus}</p>
            {m.topThree.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            <p>{m.nonNegotiable}</p>
            <p>{m.avoid}</p>
            <p className="note-text">{m.notes}</p>
          </article>
        ))}
        {data.dayPlans.map((p) => (
          <article className="history-entry" key={p.date}>
            <h3>
              {p.date}
              {p.lowEnergy ? " · smaller plan" : ""}
            </h3>
            {p.taskIds.map((id) => (
              <p key={id}>{data.openLoops.find((t) => t.id === id)?.title}</p>
            ))}
            {p.smallActions.map((a) => (
              <p key={a.id}>
                {a.completedAt ? "✓ " : ""}
                {a.text || data.openLoops.find((t) => t.id === a.taskId)?.title}
              </p>
            ))}
          </article>
        ))}
      </details>
      <details className="section-details">
        <summary>Categories</summary>
        {data.categories.map((c) => (
          <div className="stack" key={c.id}>
            <Field label="Category name">
              <input
                value={c.name}
                onChange={(e) =>
                  commit((d) => ({
                    ...d,
                    categories: d.categories.map((x) =>
                      x.id === c.id ? { ...x, name: e.target.value } : x,
                    ),
                  }))
                }
              />
            </Field>
            <button
              className="quiet"
              onClick={() =>
                commit((d) => ({
                  ...d,
                  categories: d.categories.map((x) =>
                    x.id === c.id ? { ...x, archived: !x.archived } : x,
                  ),
                }))
              }
            >
              {c.archived ? "Restore" : "Archive"}
            </button>
          </div>
        ))}
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              commit((d) => ({
                ...d,
                categories: [
                  ...d.categories,
                  {
                    id: uid("cat"),
                    name: category,
                    archived: false,
                    createdAt: nowIso(),
                  },
                ],
              }))
            )
              setCategory("");
          }}
        >
          <Field label="New category">
            <input
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </Field>
          <button className="secondary">Add category</button>
        </form>
      </details>
      <section className="project-section stack">
        <h2>Backup & restore</h2>
        <p className="muted">
          Your information stays in this browser. Export a backup to keep a copy
          somewhere safe.
        </p>
        <button className="primary" onClick={() => exportDataJson(data)}>
          Export JSON backup
        </button>
        <Field label="Import JSON backup">
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const imported = await importDataFromFile(file);
                if (
                  window.confirm(
                    `Replace current data with ${imported.openLoops.length} tasks, ${imported.notes.length} notes and ${imported.projects.length} projects? A recovery copy of current data will be kept.`,
                  )
                ) {
                  replaceData(imported);
                  setError("");
                }
              } catch (err) {
                setError(
                  `${err instanceof Error ? err.message : "Import failed."} Your current data is unchanged.`,
                );
              }
              e.target.value = "";
            }}
          />
        </Field>
        {error && <p role="alert">{error}</p>}
        <button className="quiet" onClick={() => downloadRecovery()}>
          Download recovery copies
        </button>
      </section>
      {avoid && (
        <AvoidanceModal
          onClose={() => setAvoid(false)}
          onSave={(a) => {
            addAvoidance({ ...a, avoidedThing: a.avoidedThing || "" });
            setAvoid(false);
          }}
        />
      )}
    </>
  );
}
export function downloadRecovery() {
  const copies: Record<string, unknown> = {};
  for (const key of [
    "lifeops:pre-migration",
    "lifeops:before-import",
    "lifeops:fallback",
    "lifeops:data:v6",
  ]) {
    const raw = localStorage.getItem(key);
    if (raw) copies[key] = raw;
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(copies, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "lifeops-recovery-copies.json";
  a.click();
  URL.revokeObjectURL(url);
}
