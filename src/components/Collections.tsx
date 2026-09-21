import { useState } from "react";
import type { CapturedNote, OpenLoop, Project } from "../types";
import { useLifeOps } from "../state/LifeOpsContext";
import { active } from "../domain/data";
import { formatDate, nowIso, uid } from "../utils/date";
import { TaskRow, PlanPicker, type TaskIntent } from "./TaskTools";
import { Field, Sheet } from "./Sheet";
export function Inbox({
  date,
  onTask,
  onDone,
  onNote,
}: {
  date: string;
  onTask: (i: TaskIntent) => void;
  onDone: (t: OpenLoop) => void;
  onNote: (n: CapturedNote) => void;
}) {
  const { data } = useLifeOps();
  const [filter, setFilter] = useState("Inbox");
  const [search, setSearch] = useState("");
  const notes = data.notes.filter(
    (n) =>
      (filter === "Inbox"
        ? n.state === "inbox"
        : filter === "Notes"
          ? n.state === "note"
          : filter === "Archived"
            ? n.state === "archived"
            : false) && n.text.toLowerCase().includes(search.toLowerCase()),
  );
  const tasks = data.openLoops
    .filter((t) =>
      filter === "Tasks"
        ? active(t)
        : filter === "Later"
          ? active(t) && !!t.plannedDate && t.plannedDate > date
          : filter === "Someday"
            ? active(t) && t.plannedDate === "someday"
            : filter === "Completed"
              ? t.status === "Done"
              : filter === "Archived"
                ? t.status === "Dropped" || !!t.archivedAt
                : filter === "Inbox"
                  ? active(t) && t.status === "Captured"
                  : false,
    )
    .filter((t) => filter !== "Later" || t.plannedDate !== "someday")
    .filter((t) =>
      `${t.title} ${t.notes || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">A place to put it all</p>
        <h1>
          Inbox<span className="heading-dot">.</span>
        </h1>
        <p className="muted">
          Capture now. Make sense of it when you’re ready.
        </p>
      </div>
      <Field label="Search thoughts & tasks">
        <input
          type="search"
          placeholder="Find something…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      <div className="filters" aria-label="Inbox filters">
        {[
          "Inbox",
          "Tasks",
          "Later",
          "Someday",
          "Notes",
          "Completed",
          "Archived",
        ].map((f) => (
          <button
            aria-pressed={filter === f}
            key={f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="section-heading">
        <p className="eyebrow">
          {filter === "Inbox" ? "Unsorted thoughts" : filter}
        </p>
        <span className="muted">{notes.length + tasks.length}</span>
      </div>
      {!notes.length && !tasks.length && (
        <div className="empty-list">
          <h2>
            {search
              ? "Nothing found."
              : filter === "Inbox"
                ? "A little space in your head."
                : "Nothing here yet."}
          </h2>
          <p className="muted">
            {filter === "Inbox"
              ? "Tap Add whenever something comes to mind."
              : "Your saved items will appear here."}
          </p>
        </div>
      )}
      {notes.map((n) => (
        <button className="note-row" key={n.id} onClick={() => onNote(n)}>
          <span className="note-text">{n.text}</span>
          <small>
            {n.relatedProjectId
              ? data.projects.find((p) => p.id === n.relatedProjectId)?.name
              : "Captured thought"}{" "}
            <span aria-hidden="true">↗</span>
          </small>
        </button>
      ))}
      {tasks.map((t) => (
        <div key={t.id}>
          <TaskRow task={t} onAction={onTask} onDone={onDone} />
          {t.plannedDate && filter === "Later" && (
            <p className="hint">Planned {formatDate(t.plannedDate)}</p>
          )}
        </div>
      ))}
    </>
  );
}
export function Projects({
  date,
  onTask,
  onDone,
  onNote,
  notify,
}: {
  date: string;
  onTask: (i: TaskIntent) => void;
  onDone: (t: OpenLoop) => void;
  onNote: (n: CapturedNote) => void;
  notify: (m: string) => void;
}) {
  const { data, commit } = useLifeOps();
  const [filter, setFilter] = useState("Active");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [link, setLink] = useState(false);
  const project = data.projects.find((p) => p.id === selected);
  const list = data.projects.filter((p) =>
    filter === "Active"
      ? !["Paused", "Archived"].includes(p.status)
      : p.status === filter,
  );
  const linked = data.openLoops.filter(
    (t) => t.relatedProjectId === project?.id,
  );
  const next =
    linked.find((t) => t.id === project?.nextActionId && active(t)) ||
    linked.find(active);
  if (project)
    return (
      <>
        <button className="quiet back" onClick={() => setSelected(null)}>
          ← All projects
        </button>
        <div className="page-heading">
          <p className="eyebrow">{project.status}</p>
          <h1 className="project-name">{project.name}</h1>
          <p className="muted">
            {project.currentObjective || "What would done look like?"}
          </p>
        </div>
        <div className="section-heading">
          <h2>Next action</h2>
          <button className="quiet" onClick={() => setEditing(project)}>
            Edit project
          </button>
        </div>
        {next ? (
          <TaskRow task={next} onAction={onTask} onDone={onDone} />
        ) : (
          <p className="muted">
            {project.nextAction ||
              "Choose a small step forward when you’re ready."}
          </p>
        )}
        <button className="primary" onClick={() => setLink(true)}>
          Choose next action
        </button>
        <section className="project-section">
          <h2>Notes</h2>
          {project.notes && <p className="note-text">{project.notes}</p>}
          {data.notes
            .filter((n) => n.relatedProjectId === project.id)
            .map((n) => (
              <button className="note-row" key={n.id} onClick={() => onNote(n)}>
                {n.text}
              </button>
            ))}
          {!project.notes &&
            !data.notes.some((n) => n.relatedProjectId === project.id) && (
              <p className="muted">Link a captured note here from Inbox.</p>
            )}
          {project.links?.map((l) => (
            <p key={l.url}>
              {/^https?:\/\//i.test(l.url) ? (
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ) : (
                l.label
              )}
            </p>
          ))}
        </section>
        <details className="section-details">
          <summary>Linked tasks · {linked.length}</summary>
          {linked.map((t) => (
            <TaskRow key={t.id} task={t} onAction={onTask} onDone={onDone} />
          ))}
        </details>
        <details className="section-details">
          <summary>Project history</summary>
          {project.lastWorkedAt && (
            <p className="muted">
              Last activity{" "}
              {new Date(project.lastWorkedAt).toLocaleDateString()}
            </p>
          )}
          {linked
            .filter((t) => t.status === "Done")
            .map((t) => (
              <p key={t.id}>
                ✓ {t.title} · {t.completionDate || t.completedAt?.slice(0, 10)}
              </p>
            ))}
          {data.aarReviews
            .filter((r) => r.relatedProjectId === project.id)
            .map((r) => (
              <article key={r.id}>
                <h3>{r.title}</h3>
                <p>{r.actualOutcome}</p>
              </article>
            ))}
        </details>
        {link && (
          <PlanPicker
            date={date}
            projectId={project.id}
            onClose={() => setLink(false)}
            onSaved={notify}
          />
        )}
        {editing && (
          <ProjectEditor project={editing} onClose={() => setEditing(null)} />
        )}
      </>
    );
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Move something meaningful forward</p>
        <h1>
          Projects<span className="heading-dot">.</span>
        </h1>
        <p className="muted">An outcome. A next step. One thing at a time.</p>
      </div>
      <div className="section-heading">
        <div className="filters">
          {["Active", "Paused", "Archived"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          aria-label="New project"
          className="quiet"
          onClick={() => setEditing({})}
        >
          ＋ New
        </button>
      </div>
      {!list.length && (
        <div className="empty-list">
          <h2>Make room for what matters.</h2>
          <p className="muted">
            Projects are for outcomes with a few steps. Everyday tasks can stand
            on their own.
          </p>
          <button className="primary" onClick={() => setEditing({})}>
            Create a project
          </button>
        </div>
      )}
      {list.map((p) => {
        const next =
          data.openLoops.find(
            (t) =>
              t.id === p.nextActionId &&
              t.relatedProjectId === p.id &&
              active(t),
          ) ||
          data.openLoops.find((t) => t.relatedProjectId === p.id && active(t));
        return (
          <button
            className="project-row"
            key={p.id}
            onClick={() => setSelected(p.id)}
          >
            <div>
              <h2>{p.name}</h2>
              <p className="muted">
                {p.currentObjective || "Add a desired outcome"}
              </p>
              <p className="project-next">
                <span>Next</span>{" "}
                {next?.title || p.nextAction || "Choose a next action"}
              </p>
            </div>
            <span aria-hidden="true">↗</span>
          </button>
        );
      })}
      {editing && (
        <ProjectEditor project={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
function ProjectEditor({
  project,
  onClose,
}: {
  project: Partial<Project>;
  onClose: () => void;
}) {
  const { commit } = useLifeOps();
  const [draft, setDraft] = useState(project);
  return (
    <Sheet
      title={project.id ? "Edit project" : "A new project"}
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const now = nowIso();
          const p = {
            id: uid("project"),
            name: "",
            status: "Planning" as const,
            createdAt: now,
            ...draft,
            updatedAt: now,
          } as Project;
          if (
            commit((d) => ({
              ...d,
              projects: project.id
                ? d.projects.map((x) => (x.id === project.id ? p : x))
                : [...d.projects, p],
            }))
          )
            onClose();
        }}
      >
        <Field label="Project name">
          <input
            required
            value={draft.name || ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Desired outcome">
          <textarea
            value={draft.currentObjective || ""}
            onChange={(e) =>
              setDraft({ ...draft, currentObjective: e.target.value })
            }
            placeholder="What will be different when this is done?"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={draft.notes || ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            value={draft.status || "Planning"}
            onChange={(e) =>
              setDraft({
                ...draft,
                status: e.target.value as Project["status"],
              })
            }
          >
            {[
              "Idea",
              "Planning",
              "Building",
              "Revising",
              "Deployed",
              "Paused",
              "Archived",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <button className="primary">Save project</button>
      </form>
    </Sheet>
  );
}
