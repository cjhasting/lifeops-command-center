import { useState } from "react";
import type { AppData, CapturedNote, OpenLoop } from "../types";
import { useLifeOps } from "../state/LifeOpsContext";
import {
  active,
  completeTask,
  extractTasks,
  newTask,
  planFor,
  schedule,
  setPlan,
} from "../domain/data";
import { addDays, nowIso } from "../utils/date";
import { Field, Sheet } from "./Sheet";
export type TaskIntent = {
  kind: "edit" | "later" | "smaller" | "today";
  task: OpenLoop;
};
export function TaskRow({
  task,
  onAction,
  onDone,
  main = false,
}: {
  task: OpenLoop;
  onAction: (intent: TaskIntent) => void;
  onDone: (t: OpenLoop) => void;
  main?: boolean;
}) {
  return (
    <article className={`task-row ${main ? "main-task" : ""}`}>
      <div className="task-heading">
        <button
          className="check"
          aria-label={`${task.status === "Done" ? "Undo" : "Complete"} ${task.title}`}
          onClick={() => onDone(task)}
        >
          {task.status === "Done" ? "✓" : <span />}
        </button>
        <div className="task-copy">
          <button
            className="task-title"
            onClick={() => onAction({ kind: "edit", task })}
          >
            {task.title}
          </button>
          {task.nextAction && <p className="muted">{task.nextAction}</p>}
        </div>
      </div>
      {active(task) && (
        <div className="row-actions">
          <button onClick={() => onAction({ kind: "later", task })}>
            Later
          </button>
          <button onClick={() => onAction({ kind: "smaller", task })}>
            Make smaller
          </button>
          <button
            aria-label={`Plan ${task.title}`}
            onClick={() => onAction({ kind: "today", task })}
          >
            Plan
          </button>
        </div>
      )}
    </article>
  );
}
export function TaskEditor({
  intent,
  date,
  onClose,
  onSaved,
}: {
  intent: TaskIntent;
  date: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { data, commit } = useLifeOps();
  const { task, kind } = intent;
  const [draft, setDraft] = useState(task);
  const [when, setWhen] = useState(addDays(date, 1));
  const save = (fn: (d: AppData) => AppData, message: string) => {
    if (commit(fn)) {
      onSaved(message);
      onClose();
    }
  };
  const patch = (p: Partial<OpenLoop>) =>
    save(
      (d) => ({
        ...d,
        openLoops: d.openLoops.map((t) =>
          t.id === task.id ? { ...t, ...p, updatedAt: nowIso() } : t,
        ),
      }),
      "Changes saved",
    );
  if (kind === "later")
    return (
      <Sheet title="Make room for later" onClose={onClose}>
        <p className="muted">Your deadline stays the same.</p>
        <button
          className="primary wide"
          onClick={() =>
            save(
              (d) => schedule(d, task.id, addDays(date, 1), date),
              "Moved to tomorrow",
            )
          }
        >
          Tomorrow
        </button>
        <Field label="Choose date">
          <input
            type="date"
            required
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>
        <button
          className="secondary wide"
          disabled={!when}
          onClick={() =>
            save((d) => schedule(d, task.id, when, date), "Planned date saved")
          }
        >
          Use this date
        </button>
        <button
          className="quiet wide"
          onClick={() =>
            save(
              (d) => schedule(d, task.id, "someday", date),
              "Saved for someday",
            )
          }
        >
          Someday
        </button>
      </Sheet>
    );
  if (kind === "today")
    return (
      <PlanPicker
        date={date}
        selected={task.id}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  return (
    <Sheet
      title={kind === "smaller" ? "A smaller next step" : "Task details"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          patch(draft);
        }}
        className="stack"
      >
        {kind === "smaller" ? (
          <>
            <p className="context-text">{task.title}</p>
            <Field label="Concrete next step">
              <textarea
                value={draft.nextAction || ""}
                onChange={(e) =>
                  setDraft({ ...draft, nextAction: e.target.value })
                }
              />
            </Field>
            <Field label="Minimum version">
              <input
                placeholder="For example, put on walking shoes"
                value={draft.minimumVersion || ""}
                onChange={(e) =>
                  setDraft({ ...draft, minimumVersion: e.target.value })
                }
              />
            </Field>
            <p className="muted">
              Doing the minimum counts as a small step. The whole task stays
              open.
            </p>
          </>
        ) : (
          <>
            <Field label="Task">
              <textarea
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Next step">
              <input
                value={draft.nextAction || ""}
                onChange={(e) =>
                  setDraft({ ...draft, nextAction: e.target.value })
                }
              />
            </Field>
            <Field label="Minimum version">
              <input
                value={draft.minimumVersion || ""}
                onChange={(e) =>
                  setDraft({ ...draft, minimumVersion: e.target.value })
                }
              />
            </Field>
            <details>
              <summary>Optional details</summary>
              <div className="stack">
                <Field label="Deadline">
                  <input
                    type="date"
                    value={draft.dueDate || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        dueDate: e.target.value || undefined,
                      })
                    }
                  />
                </Field>
                <Field label="Follow up on">
                  <input
                    type="date"
                    value={draft.followUpDate || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        followUpDate: e.target.value || undefined,
                      })
                    }
                  />
                </Field>
                <Field label="Project">
                  <select
                    value={draft.relatedProjectId || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        relatedProjectId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">No project</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Repeat">
                  <select
                    value={draft.repeat || "None"}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        repeat: e.target.value as OpenLoop["repeat"],
                      })
                    }
                  >
                    {["None", "Daily", "Weekly", "Monthly"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={draft.categoryId || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        categoryId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">No category</option>
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Notes">
                  <textarea
                    value={draft.notes || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                  />
                </Field>
              </div>
            </details>
            {task.sourceNoteId && (
              <details>
                <summary>Original captured note</summary>
                <p className="note-text">
                  {data.notes.find((n) => n.id === task.sourceNoteId)?.text ||
                    "Source note unavailable"}
                </p>
              </details>
            )}
          </>
        )}
        <button className="primary" disabled={!draft.title.trim()}>
          Save changes
        </button>
        {kind === "edit" && (
          <button
            type="button"
            className="quiet"
            onClick={() =>
              patch({
                status: task.status === "Dropped" ? "Next Action" : "Dropped",
              })
            }
          >
            {task.status === "Dropped" ? "Restore task" : "Drop task"}
          </button>
        )}
      </form>
    </Sheet>
  );
}
export function PlanPicker({
  date,
  selected,
  onClose,
  onSaved,
  projectId,
}: {
  date: string;
  selected?: string;
  onClose: () => void;
  onSaved: (m: string) => void;
  projectId?: string;
}) {
  const { data, commit } = useLifeOps();
  const [id, setId] = useState(selected || "");
  const [title, setTitle] = useState("");
  const [replace, setReplace] = useState("");
  const [search, setSearch] = useState("");
  const plan = planFor(data, date);
  const full = plan.taskIds.length >= 3 && !plan.taskIds.includes(id);
  const task = data.openLoops.find((t) => t.id === id);
  function add() {
    const t = task || newTask(title.trim(), { relatedProjectId: projectId });
    if (!t.title) return;
    const ok = commit((d) => {
      let next = task ? d : { ...d, openLoops: [t, ...d.openLoops] };
      if (projectId)
        return {
          ...next,
          projects: next.projects.map((p) =>
            p.id === projectId
              ? { ...p, nextActionId: t.id, updatedAt: nowIso() }
              : p,
          ),
          openLoops: next.openLoops.map((x) =>
            x.id === t.id ? { ...x, relatedProjectId: projectId } : x,
          ),
        };
      const p = planFor(next, date);
      if (p.taskIds.includes(t.id)) return next;
      if (p.taskIds.length >= 3 && !replace) return next;
      const ids = replace
        ? p.taskIds.map((x) => (x === replace ? t.id : x))
        : [...p.taskIds, t.id];
      return setPlan(
        {
          ...next,
          openLoops: next.openLoops.map((x) =>
            x.id === t.id ? { ...x, plannedDate: date } : x,
          ),
        },
        { ...p, taskIds: ids },
      );
    });
    if (ok) {
      onSaved(projectId ? "Action linked to project" : "Plan saved");
      onClose();
    }
  }
  return (
    <Sheet
      title={projectId ? "Choose a project action" : "Choose one useful action"}
      onClose={onClose}
    >
      <div className="stack">
        {!selected && (
          <>
            <Field label="Create an action">
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setId("");
                }}
                placeholder="A small, concrete next step"
              />
            </Field>
            <p className="eyebrow">Or choose an existing task</p>
            <Field label="Find a task">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <div className="choice-list">
              {data.openLoops
                .filter(active)
                .filter((t) =>
                  t.title.toLowerCase().includes(search.toLowerCase()),
                )
                .map((t) => (
                  <label className="choice" key={t.id}>
                    <input
                      type="radio"
                      name="task"
                      checked={id === t.id}
                      onChange={() => {
                        setId(t.id);
                        setTitle("");
                      }}
                    />
                    <span>{t.title}</span>
                  </label>
                ))}
            </div>
          </>
        )}
        {selected && <p>{task?.title}</p>}
        {!projectId && full && (
          <>
            <p>
              Your three places are full. Replace one, or leave this for later.
            </p>
            <Field label="Replace an action">
              <select
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
              >
                <option value="">Choose an action</option>
                {plan.taskIds.map((x) => (
                  <option value={x} key={x}>
                    {data.openLoops.find((t) => t.id === x)?.title}
                  </option>
                ))}
              </select>
            </Field>
            <button
              className="quiet"
              onClick={() => {
                if (title.trim() && !task) {
                  if (
                    !commit((d) => ({
                      ...d,
                      openLoops: [newTask(title.trim()), ...d.openLoops],
                    }))
                  )
                    return;
                }
                onClose();
              }}
            >
              Leave for later
            </button>
          </>
        )}
        <button
          className="primary wide"
          disabled={(!id && !title.trim()) || (!projectId && full && !replace)}
          onClick={add}
        >
          {projectId ? "Link action" : "Save plan"}
        </button>
      </div>
    </Sheet>
  );
}
export function NoteTools({
  note,
  onClose,
  date,
  onSaved,
  onTask,
}: {
  note: CapturedNote;
  onClose: () => void;
  date: string;
  onSaved: (m: string) => void;
  onTask: (i: TaskIntent) => void;
}) {
  const { data, commit } = useLifeOps();
  const [extract, setExtract] = useState(false);
  const [project, setProject] = useState(note.relatedProjectId || "");
  const [lines, setLines] = useState(
    note.text
      .split("\n")
      .map((text, index) => ({ text, index, selected: false })),
  );
  const change = (state: CapturedNote["state"]) => {
    if (
      commit((d) => ({
        ...d,
        notes: d.notes.map((n) =>
          n.id === note.id
            ? { ...n, state, relatedProjectId: project || undefined }
            : n,
        ),
      }))
    ) {
      onSaved(state === "note" ? "Kept as note" : "Archived");
      onClose();
    }
  };
  const convert = (kind: "today" | "later") => {
    const existing = data.openLoops.find(
      (t) => t.extractionKey === `${note.id}:whole`,
    );
    const t =
      existing ||
      newTask(note.text, {
        sourceNoteId: note.id,
        extractionKey: `${note.id}:whole`,
        relatedProjectId: project || undefined,
      });
    if (
      commit((d) => ({
        ...d,
        openLoops: existing ? d.openLoops : [t, ...d.openLoops],
        notes: d.notes.map((n) =>
          n.id === note.id ? { ...n, state: "note" } : n,
        ),
      }))
    ) {
      onClose();
      onTask({ kind, task: t });
    }
  };
  return (
    <Sheet
      title={extract ? "Create tasks from this note" : "Captured thought"}
      onClose={onClose}
    >
      <div className="stack">
        <p className="note-text">{note.text}</p>
        {extract ? (
          <>
            <p className="muted">
              Choose lines and adjust their wording. Your original stays intact.
            </p>
            {lines.map((line, i) => (
              <div className="extract-line" key={line.index}>
                <input
                  aria-label={`Select line ${i + 1}`}
                  type="checkbox"
                  disabled={
                    !line.text.trim() ||
                    data.openLoops.some(
                      (t) => t.extractionKey === `${note.id}:${i}`,
                    )
                  }
                  checked={line.selected}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, j) =>
                        j === i ? { ...l, selected: e.target.checked } : l,
                      ),
                    )
                  }
                />
                <textarea
                  aria-label={`Task from line ${i + 1}`}
                  value={line.text}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, j) =>
                        j === i ? { ...l, text: e.target.value } : l,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <button
              className="primary"
              disabled={!lines.some((l) => l.selected && l.text.trim())}
              onClick={() => {
                if (
                  commit((d) =>
                    extractTasks(
                      d,
                      note.id,
                      lines.filter((l) => l.selected),
                    ),
                  )
                ) {
                  onSaved("Tasks created. Original note retained.");
                  onClose();
                }
              }}
            >
              Create selected tasks
            </button>
          </>
        ) : (
          <>
            <button className="primary" onClick={() => convert("today")}>
              Add to Today
            </button>
            <div className="button-row">
              <button className="secondary" onClick={() => convert("later")}>
                Later
              </button>
              <button className="secondary" onClick={() => change("note")}>
                Keep as note
              </button>
            </div>
            <button className="quiet" onClick={() => setExtract(true)}>
              Create tasks from this note
            </button>
            <Field label="Add to project">
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">No project</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              className="secondary"
              onClick={() => {
                if (
                  commit((d) => ({
                    ...d,
                    notes: d.notes.map((n) =>
                      n.id === note.id
                        ? { ...n, relatedProjectId: project || undefined }
                        : n,
                    ),
                  }))
                ) {
                  onSaved("Project saved");
                  onClose();
                }
              }}
            >
              Save project
            </button>
            <button
              className="quiet"
              onClick={() =>
                change(note.state === "archived" ? "note" : "archived")
              }
            >
              {note.state === "archived" ? "Restore note" : "Archive"}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
export { completeTask };
