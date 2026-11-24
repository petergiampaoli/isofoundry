"use client";

import { useEffect } from "react";
import { saveProjectState } from "@/lib/storage";
import { useStudio } from "@/store/studio";
import StartScreen from "./StartScreen";
import Studio from "./Studio";

export default function StudioApp() {
  const view = useStudio((state) => state.view);
  const doc = useStudio((state) => state.doc);
  const versions = useStudio((state) => state.versions);
  const loadLastProject = useStudio((state) => state.loadLastProject);
  const status = useStudio((state) => state.status);
  const warning = useStudio((state) => state.warning);
  const error = useStudio((state) => state.error);
  const setError = useStudio((state) => state.setError);

  useEffect(() => {
    void loadLastProject();
  }, [loadLastProject]);

  useEffect(() => {
    if (!doc) return;
    window.localStorage.setItem("isofoundry-character:last-project", doc.id);
    const timer = window.setTimeout(() => {
      void saveProjectState(doc, versions);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [doc, versions]);

  return (
    <div className="app-root">
      {view === "start" ? <StartScreen /> : <Studio />}

      <div className="toast-stack" aria-live="polite">
        {status ? <div className="toast toast-status">{status}</div> : null}
        {warning ? <div className="toast toast-warning">{warning}</div> : null}
        {error ? (
          <button
            type="button"
            className="toast toast-error"
            onClick={() => setError(null)}
          >
            {error} ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
