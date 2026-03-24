import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fmtMins, localDateToUTCEnd, localDateToUTCStart } from "../../utils/time";

const PALETTE = [
  "#e85d3a", "#f59e0b", "#4ade80", "#60a5fa", "#a78bfa",
  "#f472b6", "#34d399", "#fb923c", "#38bdf8", "#a3e635",
];

function PieChart({ slices, pieHole }) {
  const R = 68;
  const CX = 88;
  const CY = 88;
  const C = 2 * Math.PI * R;

  if (slices.length === 0) return null;

  let paths = null;
  if (slices.length === 1) {
    paths = <circle cx={CX} cy={CY} r={R} fill={slices[0].color} />;
  } else {
    let offset = 0;
    paths = slices.map(({ pct, color }, i) => {
      const dash = (pct / 100) * C;
      const el = (
        <circle
          key={i}
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={color}
          strokeWidth="32"
          strokeDasharray={`${dash} ${C - dash}`}
          strokeDashoffset={-offset}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      );
      offset += dash;
      return el;
    });
  }

  return (
    <div className="pie-wrap" style={{ marginTop: "0.5rem" }}>
      <svg width="176" height="176" viewBox="0 0 176 176">
        {paths}
        <circle cx={CX} cy={CY} r={R - 16} fill={pieHole} />
      </svg>
    </div>
  );
}

export default function StatsSection() {
  const { apiFetch } = useAuth();
  const { pieHole } = useTheme();
  const [tab, setTab] = useState("single");
  const [singleDate, setSingleDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);

  async function queryStats() {
    setStatus("");
    setResult(null);
    let start, end;
    if (tab === "single") {
      if (!singleDate) { setStatus("Pick a date."); return; }
      start = localDateToUTCStart(singleDate);
      end = localDateToUTCEnd(singleDate);
    } else {
      if (!rangeStart || !rangeEnd) { setStatus("Pick a date range."); return; }
      start = localDateToUTCStart(rangeStart);
      end = localDateToUTCEnd(rangeEnd);
    }
    try {
      const res = await apiFetch(`/stats?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (!res.ok) throw new Error((await res.json()).detail);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      if (e.message !== "Unauthorized") setStatus(e.message);
    }
  }

  const sorted = result
    ? Object.entries(result.percentages).sort((a, b) => b[1] - a[1])
    : [];
  const colorMap = {};
  sorted.forEach(([label], i) => { colorMap[label] = PALETTE[i % PALETTE.length]; });
  const totalMins = result ? Object.values(result.minutes).reduce((a, b) => a + b, 0) : 0;
  const slices = sorted.map(([label, pct]) => ({ pct, color: colorMap[label] }));

  return (
    <div className="stats-inner">
      <div className="tabs">
        <button className={`tab${tab === "single" ? " active" : ""}`} onClick={() => setTab("single")}>
          Single date
        </button>
        <button className={`tab${tab === "range" ? " active" : ""}`} onClick={() => setTab("range")}>
          Date range
        </button>
      </div>

      <div className={`tab-panel${tab === "single" ? " active" : ""}`}>
        <div className="row" style={{ alignItems: "flex-end", gap: "0.5rem" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
          </div>
          <button className="sm" onClick={queryStats}>Go</button>
        </div>
      </div>

      <div className={`tab-panel${tab === "range" ? " active" : ""}`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.4rem", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>From</label>
            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>To</label>
            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>
          <button className="sm" onClick={queryStats}>Go</button>
        </div>
      </div>

      {status && <p className="status error" style={{ marginTop: "0.6rem" }}>{status}</p>}

      {result && (
        <div style={{ marginTop: "1.1rem" }}>
          <div className="stats-summary">
            <div className="stat-summary-cell">
              <div className="stat-summary-label">Total tracked</div>
              <div className="stat-summary-value">{fmtMins(totalMins)}</div>
            </div>
            <div className="stat-summary-cell">
              <div className="stat-summary-label">Activities</div>
              <div className="stat-summary-value">{sorted.length}</div>
            </div>
          </div>

          <PieChart slices={slices} pieHole={pieHole} />

          {sorted.map(([label, pct]) => (
            <div key={label} className="stat-row">
              <div className="stat-header">
                <span className="stat-label-wrap">
                  <span className="stat-dot" style={{ background: colorMap[label] }} />
                  <span className="stat-label">{label}</span>
                </span>
                <span className="stat-meta">{fmtMins(result.minutes[label])} · {pct}%</span>
              </div>
              <div className="bar-wrap">
                <div className="bar" style={{ width: `${pct}%`, background: colorMap[label] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
