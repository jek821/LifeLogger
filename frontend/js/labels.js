import { API, apiFetch } from "./api.js";
import { state } from "./state.js";
import { escapeHtml } from "./utils.js";

export async function loadLabels() {
  const res = await apiFetch(`${API}/labels`);
  const data = await res.json();
  state.labels = data.labels;
  renderChips(state.labels);
  renderLabelGrid(state.labels);
}

export function renderChips(labels) {
  document.getElementById("label-chips").innerHTML = labels.length
    ? labels
        .map(
          (l) => `
          <span class="chip">${escapeHtml(l)}
            <button class="chip-delete" onclick='deleteLabel(${JSON.stringify(l)})' title="Remove">&#x2715;</button>
          </span>`
        )
        .join("")
    : `<span class="empty">No labels yet.</span>`;
}

export function renderLabelGrid(labels) {
  const active = state.activeEvent?.label;
  document.getElementById("label-grid").innerHTML = labels.length
    ? labels
        .map(
          (l) => `
          <button type="button" class="label-btn ${l === active ? "active-label" : ""}" onclick='startEvent(${JSON.stringify(l)})'>
            ${escapeHtml(l)}
          </button>`
        )
        .join("")
    : `<span class="empty">Add labels to get started.</span>`;
}

export async function addLabel() {
  const input = document.getElementById("new-label");
  const label = input.value.trim();
  const status = document.getElementById("label-status");
  if (!label) return;
  status.className = "status";
  status.textContent = "";
  try {
    const res = await apiFetch(`${API}/labels`, { method: "POST", body: JSON.stringify({ label }) });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    const data = await res.json();
    state.labels = data.labels;
    input.value = "";
    renderChips(state.labels);
    renderLabelGrid(state.labels);
    status.textContent = `"${label}" added.`;
  } catch (e) {
    if (e.message === "Unauthorized") return;
    status.className = "status error";
    status.textContent = e.message;
  }
}

export async function deleteLabel(label) {
  const status = document.getElementById("label-status");
  try {
    const res = await apiFetch(`${API}/labels/${encodeURIComponent(label)}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    const data = await res.json();
    state.labels = data.labels;
    renderChips(state.labels);
    renderLabelGrid(state.labels);
  } catch (e) {
    if (e.message === "Unauthorized") return;
    status.className = "status error";
    status.textContent = e.message;
  }
}
