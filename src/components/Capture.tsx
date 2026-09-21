import { useRef, useState } from "react";
import { useLifeOps } from "../state/LifeOpsContext";
import { nowIso, uid } from "../utils/date";
import { Field, Sheet } from "./Sheet";
const KEY = "lifeops:capture-draft";
export function Capture({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, commit } = useLifeOps();
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(KEY) || "";
    } catch {
      return "";
    }
  });
  const [project, setProject] = useState("");
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const saving = useRef(false);
  function change(value: string) {
    setText(value);
    try {
      localStorage.setItem(KEY, value);
      setError("");
    } catch {
      setError(
        "Draft could not be saved. Keep this window open until you save.",
      );
    }
  }
  function close() {
    if (error && text) {
      setDiscard(true);
      return;
    }
    onClose();
  }
  return (
    <Sheet title="A little less on your mind" onClose={close}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (saving.current || !text.trim()) return;
          saving.current = true;
          const now = nowIso();
          const saved = commit((d) => ({
            ...d,
            notes: [
              {
                id: uid("note"),
                text,
                state: "inbox",
                relatedProjectId: project || undefined,
                createdAt: now,
                updatedAt: now,
              },
              ...d.notes,
            ],
          }));
          if (saved) {
            try {
              localStorage.removeItem(KEY);
            } catch {
              /* A stale draft can be discarded later. */
            }
            onSaved();
            onClose();
          } else {
            saving.current = false;
          }
        }}
      >
        <Field label="What’s on your mind?">
          <textarea
            autoFocus
            required
            rows={5}
            placeholder="A thought, a task, or something from Notes…"
            value={text}
            onChange={(e) => change(e.target.value)}
          />
        </Field>
        <details>
          <summary>Optional details</summary>
          <Field label="Project">
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
        </details>
        {error && <p role="alert">{error}</p>}
        {discard && (
          <button type="button" className="secondary" onClick={onClose}>
            Discard unsaved draft and close
          </button>
        )}
        <button className="primary wide" disabled={!text.trim()} type="submit">
          Save
        </button>
        <p className="hint">Saved to Inbox. No need to organize it now.</p>
        {text && !error && (
          <button
            className="quiet"
            type="button"
            onClick={() => {
              change("");
            }}
          >
            Discard draft
          </button>
        )}
      </form>
    </Sheet>
  );
}
