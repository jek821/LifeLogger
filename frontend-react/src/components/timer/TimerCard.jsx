import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { fmtLocalTime } from "../../utils/time";

export default function TimerCard({ labels, activeEvent, onEventChange }) {
  const { apiFetch } = useAuth();
  const [elapsed, setElapsed] = useState("0:00:00");
  const [status, setStatus] = useState("");
  const intervalRef = useRef(null);

  // Update elapsed time display every second
  useEffect(() => {
    function tick() {
      if (!activeEvent) {
        setElapsed("0:00:00");
        return;
      }
      const ms = Date.now() - new Date(activeEvent.started_at).getTime();
      const s = Math.floor(ms / 1000) % 60;
      const m = Math.floor(ms / 60000) % 60;
      const h = Math.floor(ms / 3600000);
      setElapsed(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }

    tick();
    if (activeEvent) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeEvent]);

  async function startEvent(label) {
    setStatus("");
    try {
      const res = await apiFetch("/event/start", {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const data = await res.json();
      onEventChange(data.event);
    } catch (e) {
      if (e.message !== "Unauthorized") setStatus(e.message);
    }
  }

  async function stopEvent() {
    setStatus("");
    try {
      const res = await apiFetch("/event/end", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).detail);
      onEventChange(null);
    } catch (e) {
      if (e.message !== "Unauthorized") setStatus(e.message);
    }
  }

  const isActive = !!activeEvent;

  return (
    <div className="card">
      <div className="timer-body">
        <div className="timer-top">
          <div className="timer-meta">
            <div className="timer-state">{isActive ? "Tracking" : "No active event"}</div>
            <div className={`timer-activity${isActive ? "" : " inactive"}`}>
              {isActive ? activeEvent.label : "Idle"}
            </div>
            <div className="timer-since">
              {isActive ? `Since ${fmtLocalTime(activeEvent.started_at)}` : ""}
            </div>
          </div>
          <div className="timer-elapsed-wrap">
            <div className={`timer-elapsed${isActive ? "" : " inactive"}`}>{elapsed}</div>
          </div>
        </div>

        {labels.length > 0 ? (
          <div className="label-grid">
            {labels.map((label) => (
              <button
                key={label}
                type="button"
                className={`label-btn${isActive && activeEvent.label === label ? " active-label" : ""}`}
                onClick={() => startEvent(label)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">Add labels to get started.</p>
        )}

        <div className="timer-footer">
          {isActive && (
            <button className="sm secondary" onClick={stopEvent}>Stop</button>
          )}
        </div>
        {status && <p className="status error">{status}</p>}
      </div>
    </div>
  );
}
