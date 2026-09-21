import { useLifeOps } from "../state/LifeOpsContext";
import { useEffect, useId, useRef, type ReactNode } from "react";
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { error } = useLifeOps();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current!;
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>(
        "textarea, input:not([type=checkbox]):not([type=radio]), select",
      )
      ?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div className="sheet-inner">
        <header>
          <h2 id={id}>{title}</h2>
          <button className="quiet" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </header>
        <div className="sheet-body">
          {error && (
            <p className="save-error" role="alert">
              {error}
            </p>
          )}
          {children}
        </div>
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
