import { useState } from "react";
import { useLifeOps } from "../state/LifeOpsContext";
import type { OpenLoop, PlanAction } from "../types";
import { active, planFor, saveWrap, schedule, setPlan } from "../domain/data";
import { addDays, formatDate, nowIso, todayKey, uid } from "../utils/date";
import { TaskRow, type TaskIntent } from "./TaskTools";
import { Sheet, Field } from "./Sheet";
type Props = {
  date: string;
  onTask: (i: TaskIntent) => void;
  onDone: (t: OpenLoop) => void;
  onPlan: () => void;
  notify: (m: string) => void;
};
export function Today({ date, onTask, onDone, onPlan, notify }: Props) {
  const { data, commit } = useLifeOps();
  const plan = planFor(data, date);
  const [small, setSmall] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [showNormal, setShowNormal] = useState(false);
  const planned = plan.taskIds
    .map((id) => data.openLoops.find((t) => t.id === id)!)
    .filter(Boolean);
  const pending = planned.filter(active);
  const done = data.openLoops.filter(
    (t) =>
      t.completionDate === date ||
      (t.completedAt &&
        t.status === "Done" &&
        todayKey(new Date(t.completedAt)) === date),
  );
  const attention = data.openLoops
    .filter(active)
    .filter(
      (t) =>
        (t.dueDate && t.dueDate <= addDays(date, 1)) ||
        (t.followUpDate && t.followUpDate <= date),
    );
  const ready = data.openLoops
    .filter(active)
    .filter(
      (t) =>
        !plan.taskIds.includes(t.id) &&
        t.plannedDate &&
        t.plannedDate !== "someday" &&
        t.plannedDate <= date,
    );
  const oldIds = new Set(
    data.dayPlans.filter((p) => p.date < date).flatMap((p) => p.taskIds),
  );
  const unfinished = data.openLoops
    .filter(active)
    .filter(
      (t) => oldIds.has(t.id) && !plan.taskIds.includes(t.id) && !t.plannedDate,
    );
  function move(id: string, direction: number) {
    commit((d) => {
      const p = planFor(d, date);
      const ids = [...p.taskIds];
      const i = ids.indexOf(id);
      let j = i + direction;
      while (j >= 0 && j < ids.length && !d.openLoops.some(t => t.id === ids[j] && active(t))) j += direction;
      if (j < 0 || j >= ids.length) return d;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return setPlan(d, { ...p, taskIds: ids });
    });
  }
  const normal = (
    <>
      {pending.length ? (
        <>
          <p className="eyebrow">
            {plan.lowEnergy ? "Your normal plan" : "One thing first"}
          </p>
          {pending.map((task, i) => (
            <div
              key={task.id}
              className={i === 0 ? "priority-block" : "support-block"}
            >
              <TaskRow
                main={i === 0}
                task={task}
                onAction={onTask}
                onDone={onDone}
              />
              <div className="order-actions">
                {i > 0 && (
                  <button
                    aria-label={`Move ${task.title} up`}
                    onClick={() => move(task.id, -1)}
                  >
                    ↑ Move up
                  </button>
                )}
                <button
                  aria-label={`Remove ${task.title} from today`}
                  onClick={() =>
                    commit((d) => {
                      const p = planFor(d, date);
                      return setPlan(d, {
                        ...p,
                        taskIds: p.taskIds.filter((id) => id !== task.id),
                      });
                    })
                  }
                >
                  Remove from plan
                </button>
              </div>
            </div>
          ))}
          <button className="quiet wide" onClick={onPlan}>
            {plan.taskIds.length >= 3
              ? "Replace an action"
              : "Choose another action"}
          </button>
        </>
      ) : (
        <div className="empty-plan">
          <span className="sun-mark" aria-hidden="true">
            ☼
          </span>
          <h2>
            {done.length
              ? "Room to breathe."
              : "A little direction.\nA lighter day."}
          </h2>
          <p>
            {done.length
              ? "Your completed work is below. Add another action only if you want to."
              : "Choose one useful action. The rest can wait."}
          </p>
          <button className="primary" onClick={onPlan}>
            Choose an action <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
    </>
  );
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">
          {new Intl.DateTimeFormat(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date(`${date}T12:00:00`))}
        </p>
        <h1>
          Today<span className="heading-dot">.</span>
        </h1>
        <p className="muted">
          {plan.lowEnergy
            ? "A smaller plan for today."
            : "A few things that matter. Room for everything else."}
        </p>
      </div>
      <button
        className={`energy-toggle ${plan.lowEnergy ? "selected" : ""}`}
        aria-pressed={plan.lowEnergy}
        onClick={() => {
          if (plan.lowEnergy)
            commit((d) =>
              setPlan(d, { ...planFor(d, date), lowEnergy: false }),
            );
          else setSmall(true);
        }}
      >
        <span aria-hidden="true">◔</span>
        {plan.lowEnergy ? "Return to normal plan" : "Low energy today"}
        <span aria-hidden="true">{plan.lowEnergy ? "↩" : "→"}</span>
      </button>
      <section className="day-plan">
        {plan.lowEnergy ? (
          <>
            <div className="section-heading">
              <p className="eyebrow">Just enough for today</p>
              <button className="quiet" onClick={() => setSmall(true)}>
                Edit
              </button>
            </div>
            {plan.smallActions.map((a) => {
              const t = data.openLoops.find((t) => t.id === a.taskId);
              const isDone =
                a.minimum || !t ? !!a.completedAt : t.status === "Done";
              return (
                <article className="small-action" key={a.id}>
                  <button
                    className="check"
                    aria-label={`${isDone ? "Undo" : "Complete"} ${a.minimum ? a.text : t?.title || a.text}`}
                    onClick={() => {
                      if (t && !a.minimum) {
                        onDone(t);
                        return;
                      }
                      commit((d) => {
                        const p = planFor(d, date);
                        return setPlan(d, {
                          ...p,
                          smallActions: p.smallActions.map((x) =>
                            x.id === a.id
                              ? {
                                  ...x,
                                  completedAt: x.completedAt
                                    ? undefined
                                    : nowIso(),
                                }
                              : x,
                          ),
                        });
                      });
                    }}
                  >
                    {isDone ? "✓" : <span />}
                  </button>
                  <div>
                    <h2>{a.minimum ? a.text : t?.title || a.text}</h2>
                    {a.minimum && (
                      <p className="muted">
                        {isDone ? "Minimum done" : "Minimum step"} · {t?.title}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
            <button
              className="quiet wide"
              onClick={() => setShowNormal(!showNormal)}
            >
              {showNormal ? "Hide" : "Show"} normal plan
            </button>
            {showNormal && normal}
          </>
        ) : (
          normal
        )}
      </section>
      {attention.length > 0 && (
        <section className="attention">
          <div className="section-heading">
            <h2>Needs attention</h2>
            <span className="muted">{attention.length}</span>
          </div>
          {attention.slice(0, 3).map((t) => (
            <button
              className="attention-row"
              key={t.id}
              onClick={() => onTask({ kind: "edit", task: t })}
            >
              <span>{t.title}</span>
              <small>
                {t.dueDate && t.dueDate <= addDays(date, 1)
                  ? `Due ${formatDate(t.dueDate)}`
                  : `Follow up ${formatDate(t.followUpDate)}`}
              </small>
            </button>
          ))}
          {attention.length > 3 && (
            <details>
              <summary>More deadlines & follow-ups</summary>
              {attention.slice(3).map((t) => (
                <button
                  className="attention-row"
                  key={t.id}
                  onClick={() => onTask({ kind: "edit", task: t })}
                >
                  {t.title}
                </button>
              ))}
            </details>
          )}
        </section>
      )}
      {(ready.length > 0 || unfinished.length > 0) && (
        <details className="section-details">
          <summary>
            Ready when you are · {ready.length + unfinished.length}
          </summary>
          <p className="muted">
            Consider these for a fresh plan. Nothing is added automatically.
          </p>
          {[...ready, ...unfinished].map((t) => (
            <button
              className="attention-row"
              key={t.id}
              onClick={() => onTask({ kind: "today", task: t })}
            >
              {t.title}
              <span>＋</span>
            </button>
          ))}
        </details>
      )}
      {done.length > 0 && (
        <details className="section-details">
          <summary>Completed today · {done.length}</summary>
          {done.map((t) => (
            <TaskRow key={t.id} task={t} onAction={onTask} onDone={onDone} />
          ))}
        </details>
      )}
      <div className="wrap-link">
        <button className="quiet" onClick={() => setWrap(true)}>
          Wrap up today <span aria-hidden="true">↗</span>
        </button>
        <p className="hint">A moment to close the day.</p>
      </div>
      {small && <SmallPlan date={date} onClose={() => setSmall(false)} />}
      {wrap && (
        <WrapUp date={date} onClose={() => setWrap(false)} notify={notify} />
      )}
    </>
  );
}
function SmallPlan({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, commit } = useLifeOps();
  const plan = planFor(data, date);
  const [actions, setActions] = useState<PlanAction[]>(plan.smallActions);
  const [essential, setEssential] = useState("");
  const ordered = [
    ...plan.taskIds,
    ...data.openLoops.filter(active).map((t) => t.id),
  ]
    .filter((id, i, ids) => ids.indexOf(id) === i)
    .map((id) => data.openLoops.find((t) => t.id === id)!)
    .filter((t) => t && active(t));
  return (
    <Sheet title="A smaller plan for today" onClose={onClose}>
      <div className="stack">
        <p className="muted">
          Choose one to three manageable actions. Your normal plan will be
          waiting.
        </p>
        {actions
          .filter((a) => !a.taskId)
          .map((a) => (
            <label className="choice" key={a.id}>
              <input
                type="checkbox"
                checked
                onChange={() =>
                  setActions(actions.filter((x) => x.id !== a.id))
                }
              />
              {a.text}
            </label>
          ))}
        {ordered.map((t) => {
          const selected = actions.some((a) => a.taskId === t.id);
          return (
            <label className="choice" key={t.id}>
              <input
                type="checkbox"
                checked={selected}
                disabled={!selected && actions.length >= 3}
                onChange={() =>
                  setActions(
                    selected
                      ? actions.filter((a) => a.taskId !== t.id)
                      : [
                          ...actions,
                          {
                            id: uid("small"),
                            taskId: t.id,
                            minimum: !!t.minimumVersion,
                            text: t.minimumVersion,
                          },
                        ],
                  )
                }
              />
              <span>
                {t.minimumVersion || t.title}
                {t.minimumVersion && <small>Minimum of {t.title}</small>}
              </span>
            </label>
          );
        })}
        <Field label="Or add a small essential">
          <input
            value={essential}
            onChange={(e) => setEssential(e.target.value)}
            placeholder="Something manageable"
          />
        </Field>
        <button
          className="secondary"
          disabled={!essential.trim() || actions.length >= 3}
          onClick={() => {
            setActions([
              ...actions,
              { id: uid("small"), text: essential.trim() },
            ]);
            setEssential("");
          }}
        >
          Add essential
        </button>
        <button
          className="primary"
          disabled={!actions.length}
          onClick={() => {
            if (
              commit((d) =>
                setPlan(d, {
                  ...planFor(d, date),
                  lowEnergy: true,
                  smallActions: actions,
                }),
              )
            )
              onClose();
          }}
        >
          Use this smaller plan
        </button>
      </div>
    </Sheet>
  );
}
function WrapUp({
  date,
  onClose,
  notify,
}: {
  date: string;
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const { data, commit } = useLifeOps();
  const [note, setNote] = useState(
    data.aarReviews.find((r) => r.date === date && r.type === "Daily")
      ?.wentWell || "",
  );
  const [first, setFirst] = useState(planFor(data, addDays(date, 1)).taskIds[0] || "");
  const [moves, setMoves] = useState<Record<string, string>>({});
  const plan = planFor(data, date);
  const pending = plan.taskIds
    .map((id) => data.openLoops.find((t) => t.id === id)!)
    .filter((t) => t && active(t));
  const completed = data.openLoops.filter((t) => t.completionDate === date);
  const [postpone, setPostpone] = useState(addDays(date, 2));
  return (
    <Sheet title="Wrap up today" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            commit((d) => {
              let next = d;
              for (const [id, move] of Object.entries(moves)) {
                if (move === "drop")
                  next = {
                    ...next,
                    openLoops: next.openLoops.map((t) =>
                      t.id === id ? { ...t, status: "Dropped" } : t,
                    ),
                  };
                else if (move)
                  next = schedule(
                    next,
                    id,
                    move === "postpone" ? postpone : move,
                    date,
                  );
              }
              return saveWrap(next, date, note, first);
            })
          ) {
            notify("Today’s wrap-up saved");
            onClose();
          }
        }}
      >
        <h3>What you completed</h3>
        {completed.length ? (
          completed.map((t) => <p key={t.id}>✓ {t.title}</p>)
        ) : (
          <p className="muted">A quiet day counts, too.</p>
        )}
        {plan.smallActions
          .filter((a) => a.completedAt)
          .map((a) => (
            <p key={a.id}>
              ✓ {a.text}
              {a.minimum ? " · minimum step" : ""}
            </p>
          ))}
        {pending.length > 0 && (
          <>
            <h3>Leave tomorrow a little lighter</h3>
            {pending.map((t) => (
              <Field key={t.id} label={t.title}>
                <select
                  value={moves[t.id] || ""}
                  onChange={(e) =>
                    setMoves({ ...moves, [t.id]: e.target.value })
                  }
                >
                  <option value="">Leave as is</option>
                  <option value={addDays(date, 1)}>Keep for tomorrow</option>
                  <option value="postpone">Choose a later date</option>
                  <option value="someday">Someday</option>
                  <option value="drop">Drop (can be restored in Inbox)</option>
                </select>
              </Field>
            ))}
            {Object.values(moves).includes("postpone") && (
              <Field label="Postpone until">
                <input
                  required
                  type="date"
                  value={postpone}
                  onChange={(e) => setPostpone(e.target.value)}
                />
              </Field>
            )}
          </>
        )}
        <Field label="Anything worth remembering?">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional. A sentence is enough."
          />
        </Field>
        <Field label="Tomorrow’s first action">
          <select value={first} onChange={(e) => setFirst(e.target.value)}>
            <option value="">Choose tomorrow</option>
            {data.openLoops
              .filter(active)
              .filter((t) => moves[t.id] !== "drop")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </Field>
        {first &&
          planFor(data, addDays(date, 1)).taskIds.length >= 3 &&
          !planFor(data, addDays(date, 1)).taskIds.includes(first) && (
            <p className="muted">
              Tomorrow is full. This replaces the third action; that task stays
              in Inbox.
            </p>
          )}
        <button className="primary">Save wrap-up</button>
      </form>
    </Sheet>
  );
}
