import { useEffect, useRef, useState } from "react";
import { useLifeOps } from "./state/LifeOpsContext";
import type { CapturedNote, OpenLoop } from "./types";
import { todayKey } from "./utils/date";
import { completeTask } from "./domain/data";
import { Capture } from "./components/Capture";
import { Today } from "./components/Today";
import { Inbox, Projects } from "./components/Collections";
import { More, downloadRecovery } from "./components/More";
import {
  NoteTools,
  PlanPicker,
  TaskEditor,
  type TaskIntent,
} from "./components/TaskTools";
function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "Today" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      ) : name === "Inbox" ? (
        <>
          <path d="M4 4h16l2 12v4H2v-4L4 4Z" />
          <path d="M2 15h6l2 3h4l2-3h6" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      )}
    </svg>
  );
}
export function App() {
  const { ready, error, clearError, commit } = useLifeOps();
  const [page, setPage] = useState("Today");
  const [date, setDate] = useState(todayKey());
  const [capture, setCapture] = useState(false);
  const [intent, setIntent] = useState<TaskIntent | null>(null);
  const [plan, setPlan] = useState(false);
  const [note, setNote] = useState<CapturedNote | null>(null);
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState<OpenLoop | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scroll = useRef<Record<string, number>>({});
  useEffect(() => {
    const tick = () => setDate(todayKey());
    const id = setInterval(tick, 10000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  function notify(message: string) {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 6000);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  function done(t: OpenLoop) {
    const completing = t.status !== "Done";
    if (commit((d) => completeTask(d, t.id, date, completing))) {
      setUndo(completing ? t : null);
      notify(
        completing
          ? t.relatedProjectId
            ? "Done. Choose the next action in Projects when you’re ready."
            : "Done. A little more room."
          : "Task restored",
      );
    }
  }
  function navigate(next: string) {
    scroll.current[page] = window.scrollY;
    setPage(next);
    requestAnimationFrame(() => window.scrollTo(0, scroll.current[next] || 0));
  }
  if (!ready)
    return (
      <main className="loading">
        <h1>LifeOps</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="primary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <button className="quiet" onClick={downloadRecovery}>
              Download recovery copies
            </button>
          </>
        ) : (
          <p>Opening your space…</p>
        )}
      </main>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Today");
          }}
          className="wordmark"
        >
          <span aria-hidden="true" className="logo-mark">
            ◒
          </span>{" "}
          lifeops
        </a>
        <button
          className="quiet more-button"
          aria-label="More: settings, reviews and history"
          aria-pressed={page === "More"}
          onClick={() => navigate("More")}
        >
          More <span aria-hidden="true">···</span>
        </button>
      </header>
      {error && (
        <div role="alert" className="save-error">
          <p>{error}</p>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      <main className="main-content">
        {page === "Today" && (
          <Today
            key={date}
            date={date}
            onTask={setIntent}
            onDone={done}
            onPlan={() => setPlan(true)}
            notify={notify}
          />
        )}
        {page === "Inbox" && (
          <Inbox
            date={date}
            onTask={setIntent}
            onDone={done}
            onNote={setNote}
          />
        )}
        {page === "Projects" && (
          <Projects
            date={date}
            onTask={setIntent}
            onDone={done}
            onNote={setNote}
            notify={notify}
          />
        )}
        {page === "More" && <More date={date} />}
      </main>
      <div className="bottom-dock">
        <div className="capture-bar">
          <button className="capture-button" onClick={() => setCapture(true)}>
            <span aria-hidden="true">＋</span> Add{" "}
            <span className="capture-hint">what’s on your mind</span>
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {["Today", "Inbox", "Projects"].map((p) => (
            <button
              key={p}
              aria-current={page === p ? "page" : undefined}
              onClick={() => navigate(p)}
            >
              <Icon name={p} />
              <span>{p}</span>
            </button>
          ))}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          {undo && (
            <button
              onClick={() => {
                if (commit((d) => completeTask(d, undo.id, date, false))) {
                  setUndo(null);
                  notify("Task restored");
                }
              }}
            >
              Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
      {capture && (
        <Capture
          onClose={() => setCapture(false)}
          onSaved={() => {
            setUndo(null);
            notify("Saved to Inbox");
          }}
        />
      )}
      {intent && (
        <TaskEditor
          key={`${intent.kind}:${intent.task.id}:${date}`}
          intent={intent}
          date={date}
          onClose={() => setIntent(null)}
          onSaved={notify}
        />
      )}
      {plan && (
        <PlanPicker
          date={date}
          onClose={() => setPlan(false)}
          onSaved={notify}
        />
      )}
      {note && (
        <NoteTools
          key={note.id}
          note={note}
          date={date}
          onClose={() => setNote(null)}
          onSaved={notify}
          onTask={setIntent}
        />
      )}
    </div>
  );
}
