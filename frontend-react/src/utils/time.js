export function localDateToUTCStart(dateStr) {
  return new Date(dateStr + "T00:00:00").toISOString();
}

export function localDateToUTCEnd(dateStr) {
  return new Date(dateStr + "T23:59:59.999").toISOString();
}

export function utcToLocalInput(utcStr) {
  const d = new Date(utcStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtLocalTime(utcStr) {
  return new Date(utcStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function fmtDuration(startUTC, endUTC) {
  const totalSecs = Math.round((new Date(endUTC) - new Date(startUTC)) / 1000);
  const s = totalSecs % 60;
  const m = Math.floor(totalSecs / 60) % 60;
  const h = Math.floor(totalSecs / 3600);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtMins(mins) {
  const totalSecs = Math.round(mins * 60);
  const s = totalSecs % 60;
  const m = Math.floor(totalSecs / 60) % 60;
  const h = Math.floor(totalSecs / 3600);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
