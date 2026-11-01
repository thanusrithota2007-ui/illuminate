export const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
export const daysUntil = d => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000));
