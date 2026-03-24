import { API, apiFetch } from "./api.js";
import { state } from "./state.js";
import { renderLabelGrid } from "./labels.js";
import { fmtLocalTime } from "./utils.js";

export function stopTimerTick() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function startTimerTick() {
  stopTimerTick();
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const elapsedEl = document.getElementById("timer-elapsed");
  const activityEl = document.getElementById("timer-activity");
  const labelEl = document.getElementById("timer-label");
  const sinceEl = document.getElementById("timer-since");
  const stopBtn = document.getElementById("stop-btn");

  if (!state.activeEvent) {
    activityEl.textContent = "Idle";
    activityEl.className = "timer-activity inactive";
    elapsedEl.textContent = "0:00:00";
    elapsedEl.className = "timer-elapsed inactive";
    labelEl.textContent = "No active event";
    sinceEl.textContent = "";
    stopBtn.style.display = "none";
    return;
  }

  const elapsed = Date.now() - new Date(state.activeEvent.started_at).getTime();
  const s = Math.floor(elapsed / 1000) % 60;
  const m = Math.floor(elapsed / 60000) % 60;
  const h = Math.floor(elapsed / 3600000);

  activityEl.textContent = state.activeEvent.label;
  activityEl.className = "timer-activity";
  elapsedEl.textContent = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  elapsedEl.className = "timer-elapsed";
  labelEl.textContent = "Tracking";
  sinceEl.textContent = `Since ${fmtLocalTime(state.activeEvent.started_at)}`;
  stopBtn.style.display = "";
}

export async function loadActiveEvent() {
  const res = await apiFetch(`${API}/event/active`);
  const data = await res.json();
  state.activeEvent = data.event;
  updateTimerDisplay();
  if (state.activeEvent) startTimerTick();
  renderLabelGrid(state.labels);
}

export async function startEvent(label) {
  const status = document.getElementById("timer-status");
  status.textContent = "";
  try {
    const res = await apiFetch(`${API}/event/start`, { method: "POST", body: JSON.stringify({ label }) });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    state.activeEvent = (await res.json()).event;
    updateTimerDisplay();
    startTimerTick();
    renderLabelGrid(state.labels);
  } catch (e) {
    if (e.message === "Unauthorized") return;
    status.textContent = e.message;
  }
}

export async function stopEvent() {
  const status = document.getElementById("timer-status");
  status.textContent = "";
  try {
    const res = await apiFetch(`${API}/event/end`, { method: "POST" });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    state.activeEvent = null;
    stopTimerTick();
    updateTimerDisplay();
    renderLabelGrid(state.labels);
  } catch (e) {
    if (e.message === "Unauthorized") return;
    status.textContent = e.message;
  }
}
