import { API, apiFetch } from "./api.js";
import { state } from "./state.js";
import {
  escapeHtml,
  fmtDuration,
  fmtLocalTime,
  localDateToUTCEnd,
  localDateToUTCStart,
  utcToLocalInput,
} from "./utils.js";

export async function loadHistory() {
  const start = document.getElementById("hist-start").value;
  const end = document.getElementById("hist-end").value;
  const list = document.getElementById("event-list");
  if (!start || !end) {
    list.innerHTML = `<span class="empty">Pick a date range.</span>`;
    return;
  }
  try {
    const res = await apiFetch(
      `${API}/events?start=${encodeURIComponent(localDateToUTCStart(start))}&end=${encodeURIComponent(localDateToUTCEnd(end))}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    renderEventList(data.events);
  } catch (e) {
    if (e.message === "Unauthorized") return;
    const listEl = document.getElementById("event-list");
    listEl.innerHTML = "";
    const span = document.createElement("span");
    span.className = "empty";
    span.textContent = e.message;
    listEl.appendChild(span);
  }
}

function renderEventList(events) {
  const list = document.getElementById("event-list");
  if (!events.length) {
    list.innerHTML = `<span class="empty">No events in this range.</span>`;
    return;
  }
  list.innerHTML = `<div class="event-list">${events
    .map(
      (ev) => `
      <div class="event-row" id="ev-${ev.id}"
           data-label="${escapeHtml(ev.label)}"
           data-start="${escapeHtml(ev.started_at)}"
           data-end="${escapeHtml(ev.ended_at || "")}">
        <div class="event-dot"></div>
        <div class="event-label-text">${escapeHtml(ev.label)}</div>
        <div class="event-actions">
          <button class="icon-btn" onclick="showEditForm(${ev.id})" title="Edit">✎</button>
          <button class="icon-btn danger" onclick="deleteHistEvent(${ev.id})" title="Delete">✕</button>
        </div>
        <div class="event-time">${fmtLocalTime(ev.started_at)} → ${ev.ended_at ? fmtLocalTime(ev.ended_at) : "<em>active</em>"}</div>
        <div class="event-duration">${ev.ended_at ? fmtDuration(ev.started_at, ev.ended_at) : "—"}</div>
      </div>`
    )
    .join("")}</div>`;
}

export function showEditForm(id) {
  const row = document.getElementById(`ev-${id}`);
  const { label: evLabel, start: evStart, end: evEnd } = row.dataset;
  const opts = state.labels
    .map((l) => `<option value="${escapeHtml(l)}" ${l === evLabel ? "selected" : ""}>${escapeHtml(l)}</option>`)
    .join("");
  row.outerHTML = `
      <div class="event-edit-form" id="ev-${id}">
        <div class="section-label" style="margin:0 0 0.25rem">Edit Entry</div>
        <div class="field">
          <label>Label</label>
          <select id="edit-label-${id}">${opts}</select>
        </div>
        <div class="two-col">
          <div class="field">
            <label>Start</label>
            <input type="datetime-local" id="edit-start-${id}" value="${escapeHtml(utcToLocalInput(evStart))}" />
          </div>
          <div class="field">
            <label>End</label>
            <input type="datetime-local" id="edit-end-${id}" value="${evEnd ? escapeHtml(utcToLocalInput(evEnd)) : ""}" />
          </div>
        </div>
        <div class="event-edit-actions">
          <button class="sm" onclick="saveEdit(${id})">Save</button>
          <button class="sm secondary" onclick="loadHistory()">Cancel</button>
        </div>
        <div class="status" id="edit-status-${id}"></div>
      </div>`;
}

export async function saveEdit(id) {
  const label = document.getElementById(`edit-label-${id}`).value;
  const startLocal = document.getElementById(`edit-start-${id}`).value;
  const endLocal = document.getElementById(`edit-end-${id}`).value;
  const status = document.getElementById(`edit-status-${id}`);
  if (!startLocal) {
    status.className = "status error";
    status.textContent = "Start time required.";
    return;
  }
  try {
    const res = await apiFetch(`${API}/event/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        label,
        started_at: new Date(startLocal).toISOString(),
        ended_at: endLocal ? new Date(endLocal).toISOString() : null,
      }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    loadHistory();
  } catch (e) {
    if (e.message === "Unauthorized") return;
    status.className = "status error";
    status.textContent = e.message;
  }
}

export async function deleteHistEvent(id) {
  if (!confirm("Delete this event?")) return;
  try {
    const res = await apiFetch(`${API}/event/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).detail);
    loadHistory();
  } catch (e) {
    if (e.message === "Unauthorized") return;
    alert(e.message);
  }
}

export function toggleAddForm() {
  const form = document.getElementById("add-form");
  const visible = form.style.display !== "none";
  form.style.display = visible ? "none" : "block";
  if (!visible) {
    const now = utcToLocalInput(new Date().toISOString());
    document.getElementById("add-start").value = now;
    document.getElementById("add-end").value = now;
    const sel = document.getElementById("add-label");
    sel.innerHTML = state.labels.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");
  }
}

export async function addManualEntry() {
  const label = document.getElementById("add-label").value;
  const startLocal = document.getElementById("add-start").value;
  const endLocal = document.getElementById("add-end").value;
  const status = document.getElementById("add-status");
  if (!startLocal) {
    status.className = "status error";
    status.textContent = "Start time required.";
    return;
  }
  try {
    const res = await apiFetch(`${API}/event/manual`, {
      method: "POST",
      body: JSON.stringify({
        label,
        started_at: new Date(startLocal).toISOString(),
        ended_at: endLocal ? new Date(endLocal).toISOString() : null,
      }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    toggleAddForm();
    loadHistory();
  } catch (e) {
    if (e.message === "Unauthorized") return;
    status.className = "status error";
    status.textContent = e.message;
  }
}
