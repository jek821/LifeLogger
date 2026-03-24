import { API, apiFetch } from "./api.js";
import { escapeHtml, fmtMins, localDateToUTCEnd, localDateToUTCStart } from "./utils.js";

const PALETTE = [
  "#e85d3a",
  "#f59e0b",
  "#4ade80",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#38bdf8",
  "#a3e635",
];

export function switchTab(card, panel, btn) {
  document.querySelectorAll(`#${card}-single, #${card}-range`).forEach((el) => el.classList.remove("active"));
  btn.closest(".tabs").querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(`${card}-${panel}`).classList.add("active");
  btn.classList.add("active");
}

export async function queryStats(mode) {
  const status = document.getElementById("stats-status");
  const result = document.getElementById("stats-result");
  status.textContent = "";
  result.innerHTML = "";

  let start;
  let end;
  if (mode === "single") {
    const d = document.getElementById("stats-s-date").value;
    if (!d) {
      status.textContent = "Pick a date.";
      return;
    }
    start = localDateToUTCStart(d);
    end = localDateToUTCEnd(d);
  } else {
    const s = document.getElementById("stats-r-start").value;
    const e = document.getElementById("stats-r-end").value;
    if (!s || !e) {
      status.textContent = "Pick a date range.";
      return;
    }
    start = localDateToUTCStart(s);
    end = localDateToUTCEnd(e);
  }

  try {
    const res = await apiFetch(`${API}/stats?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail);
    }
    const data = await res.json();
    renderStats(data.percentages, data.minutes);
  } catch (e) {
    if (e.message === "Unauthorized") return;
    status.textContent = e.message;
  }
}

function renderStats(percentages, minutes) {
  const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
  const colorMap = {};
  sorted.forEach(([label], i) => {
    colorMap[label] = PALETTE[i % PALETTE.length];
  });
  const totalMins = Object.values(minutes).reduce((a, b) => a + b, 0);
  const slices = sorted.map(([label, pct]) => ({ pct, color: colorMap[label] }));

  const summary = `
      <div class="stats-summary">
        <div class="stat-summary-cell">
          <div class="stat-summary-label">Total tracked</div>
          <div class="stat-summary-value">${fmtMins(totalMins)}</div>
        </div>
        <div class="stat-summary-cell">
          <div class="stat-summary-label">Activities</div>
          <div class="stat-summary-value">${sorted.length}</div>
        </div>
      </div>`;

  const pie = `<div class="pie-wrap" style="margin-top:0.5rem">${buildPie(slices)}</div>`;

  const rows = sorted
    .map(
      ([label, pct]) => `
      <div class="stat-row">
        <div class="stat-header">
          <span class="stat-label-wrap">
            <span class="stat-dot" style="background:${colorMap[label]}"></span>
            <span class="stat-label">${escapeHtml(label)}</span>
          </span>
          <span class="stat-meta">${fmtMins(minutes[label])} · ${pct}%</span>
        </div>
        <div class="bar-wrap"><div class="bar" style="width:${pct}%;background:${colorMap[label]}"></div></div>
      </div>`
    )
    .join("");

  document.getElementById("stats-result").innerHTML = `<div style="margin-top:1.1rem">${summary}${pie}${rows}</div>`;
}

function buildPie(slices) {
  const R = 68;
  const CX = 88;
  const CY = 88;
  const C = 2 * Math.PI * R;
  const holeColor = getComputedStyle(document.documentElement).getPropertyValue("--pie-hole").trim();
  let paths = "";
  let offset = 0;
  if (slices.length === 1) {
    paths = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${slices[0].color}" />`;
  } else {
    for (const { pct, color } of slices) {
      const dash = (pct / 100) * C;
      paths += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${color}" stroke-width="32"
          stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-offset}"
          transform="rotate(-90 ${CX} ${CY})" />`;
      offset += dash;
    }
  }
  paths += `<circle cx="${CX}" cy="${CY}" r="${R - 16}" fill="${holeColor}" />`;
  return `<svg width="176" height="176" viewBox="0 0 176 176">${paths}</svg>`;
}
