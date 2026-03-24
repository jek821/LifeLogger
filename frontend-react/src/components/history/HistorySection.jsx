import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  fmtDuration,
  fmtLocalTime,
  localDateToUTCEnd,
  localDateToUTCStart,
  utcToLocalInput,
} from "../../utils/time";

export default function HistorySection({ labels }) {
  const { apiFetch } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [events, setEvents] = useState(null); // null = not yet queried
  const [histStatus, setHistStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function loadHistory() {
    if (!startDate || !endDate) {
      setHistStatus("Pick a date range.");
      return;
    }
    setHistStatus("");
    try {
      const res = await apiFetch(
        `/events?start=${encodeURIComponent(localDateToUTCStart(startDate))}&end=${encodeURIComponent(localDateToUTCEnd(endDate))}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setEvents(data.events);
      setEditingId(null);
    } catch (e) {
      if (e.message !== "Unauthorized") setHistStatus(e.message);
    }
  }

  async function deleteEvent(id) {
    if (!confirm("Delete this event?")) return;
    try {
      const res = await apiFetch(`/event/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).detail);
      setEvents((evs) => evs.filter((e) => e.id !== id));
    } catch (e) {
      if (e.message !== "Unauthorized") alert(e.message);
    }
  }

  function openAddForm() {
    const now = utcToLocalInput(new Date().toISOString());
    setAddStart(now);
    setAddEnd(now);
    setAddLabel(labels[0] || "");
    setAddStatus({ msg: "", error: false });
    setShowAddForm(true);
  }

  // Add form state
  const [addLabel, setAddLabel] = useState("");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addStatus, setAddStatus] = useState({ msg: "", error: false });

  async function submitAddEntry(e) {
    e.preventDefault();
    if (!addStart) {
      setAddStatus({ msg: "Start time required.", error: true });
      return;
    }
    setAddStatus({ msg: "", error: false });
    try {
      const res = await apiFetch("/event/manual", {
        method: "POST",
        body: JSON.stringify({
          label: addLabel,
          started_at: new Date(addStart).toISOString(),
          ended_at: addEnd ? new Date(addEnd).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      setShowAddForm(false);
      loadHistory();
    } catch (e) {
      if (e.message !== "Unauthorized") setAddStatus({ msg: e.message, error: true });
    }
  }

  return (
    <div className="history-inner">
      <div className="history-filter">
        <div className="field">
          <label>From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button className="sm" onClick={loadHistory}>Go</button>
      </div>

      {histStatus && <p className="status error">{histStatus}</p>}

      {events !== null && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.65rem" }}>
            <button className="sm secondary" onClick={openAddForm}>+ Add entry</button>
          </div>

          {showAddForm && (
            <form className="event-edit-form" style={{ marginBottom: "0.65rem" }} onSubmit={submitAddEntry}>
              <div className="section-label" style={{ margin: "0 0 0.25rem" }}>Add Manual Entry</div>
              <div className="field">
                <label>Label</label>
                <select value={addLabel} onChange={(e) => setAddLabel(e.target.value)}>
                  {labels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="two-col">
                <div className="field">
                  <label>Start</label>
                  <input type="datetime-local" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>End</label>
                  <input type="datetime-local" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
                </div>
              </div>
              <div className="event-edit-actions">
                <button type="submit" className="sm">Save</button>
                <button type="button" className="sm secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
              {addStatus.msg && <p className={`status${addStatus.error ? " error" : ""}`}>{addStatus.msg}</p>}
            </form>
          )}

          {events.length === 0 ? (
            <p className="empty">No events in this range.</p>
          ) : (
            <div className="event-list">
              {events.map((ev) =>
                editingId === ev.id ? (
                  <EditEventForm
                    key={ev.id}
                    ev={ev}
                    labels={labels}
                    apiFetch={apiFetch}
                    onSaved={() => { setEditingId(null); loadHistory(); }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div key={ev.id} className="event-row">
                    <div className="event-dot" />
                    <div className="event-label-text">{ev.label}</div>
                    <div className="event-actions">
                      <button className="icon-btn" title="Edit" onClick={() => setEditingId(ev.id)}>✎</button>
                      <button className="icon-btn danger" title="Delete" onClick={() => deleteEvent(ev.id)}>✕</button>
                    </div>
                    <div className="event-time">
                      {fmtLocalTime(ev.started_at)} → {ev.ended_at ? fmtLocalTime(ev.ended_at) : <em>active</em>}
                    </div>
                    <div className="event-duration">
                      {ev.ended_at ? fmtDuration(ev.started_at, ev.ended_at) : "—"}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EditEventForm({ ev, labels, apiFetch, onSaved, onCancel }) {
  const [label, setLabel] = useState(ev.label);
  const [start, setStart] = useState(utcToLocalInput(ev.started_at));
  const [end, setEnd] = useState(ev.ended_at ? utcToLocalInput(ev.ended_at) : "");
  const [status, setStatus] = useState({ msg: "", error: false });

  async function handleSave(e) {
    e.preventDefault();
    if (!start) {
      setStatus({ msg: "Start time required.", error: true });
      return;
    }
    setStatus({ msg: "", error: false });
    try {
      const res = await apiFetch(`/event/${ev.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label,
          started_at: new Date(start).toISOString(),
          ended_at: end ? new Date(end).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      onSaved();
    } catch (e) {
      if (e.message !== "Unauthorized") setStatus({ msg: e.message, error: true });
    }
  }

  return (
    <form className="event-edit-form" onSubmit={handleSave}>
      <div className="section-label" style={{ margin: "0 0 0.25rem" }}>Edit Entry</div>
      <div className="field">
        <label>Label</label>
        <select value={label} onChange={(e) => setLabel(e.target.value)}>
          {labels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="two-col">
        <div className="field">
          <label>Start</label>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>End</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="event-edit-actions">
        <button type="submit" className="sm">Save</button>
        <button type="button" className="sm secondary" onClick={onCancel}>Cancel</button>
      </div>
      {status.msg && <p className={`status${status.error ? " error" : ""}`}>{status.msg}</p>}
    </form>
  );
}
