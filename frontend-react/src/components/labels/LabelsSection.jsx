import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function LabelsSection({ labels, onLabelsChange }) {
  const { apiFetch } = useAuth();
  const [newLabel, setNewLabel] = useState("");
  const [status, setStatus] = useState({ msg: "", error: false });

  async function addLabel(e) {
    e?.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    setStatus({ msg: "", error: false });
    try {
      const res = await apiFetch("/labels", {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const data = await res.json();
      onLabelsChange(data.labels);
      setNewLabel("");
      setStatus({ msg: `"${label}" added.`, error: false });
    } catch (e) {
      if (e.message !== "Unauthorized") setStatus({ msg: e.message, error: true });
    }
  }

  async function deleteLabel(label) {
    setStatus({ msg: "", error: false });
    try {
      const res = await apiFetch(`/labels/${encodeURIComponent(label)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).detail);
      const data = await res.json();
      onLabelsChange(data.labels);
    } catch (e) {
      if (e.message !== "Unauthorized") setStatus({ msg: e.message, error: true });
    }
  }

  return (
    <div className="labels-inner">
      <div className="label-chips">
        {labels.length > 0 ? (
          labels.map((label) => (
            <span key={label} className="chip">
              {label}
              <button
                className="chip-delete"
                title="Remove"
                onClick={() => deleteLabel(label)}
              >
                &#x2715;
              </button>
            </span>
          ))
        ) : (
          <span className="empty">No labels yet.</span>
        )}
      </div>

      <form className="add-label-row" onSubmit={addLabel}>
        <input
          type="text"
          placeholder="New label…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          maxLength={200}
        />
        <button type="submit" className="sm">Add</button>
      </form>

      {status.msg && (
        <p className={`status${status.error ? " error" : ""}`}>{status.msg}</p>
      )}
    </div>
  );
}
