const STORAGE_KEY = "vrc:api-base-url";

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function getApiBaseUrl() {
  if (typeof window === "undefined") return DEFAULT_API_URL;
  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_API_URL;
}

export function setApiBaseUrl(url) {
  const trimmed = (url || "").trim().replace(/\/+$/, "");
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function resetApiBaseUrl() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isDefaultApiUrl() {
  return getApiBaseUrl() === DEFAULT_API_URL;
}

export { DEFAULT_API_URL };

/**
 * Runs a reconciliation. `onSlow` fires ~4s in if we're still waiting -
 * Render's free tier spins services down after idle and can take 30-60s to
 * wake back up, so the UI can show a "waking up the server" message instead
 * of looking stuck.
 */
export async function reconcile({ vendorFile, ledgerFile, settings, onSlow }) {
  const base = getApiBaseUrl();
  const form = new FormData();
  form.append("vendor_file", vendorFile);
  form.append("ledger_file", ledgerFile);
  form.append("vendor_opening_balance", String(settings.vendorOpeningBalance ?? 0));
  form.append("ledger_opening_balance", String(settings.ledgerOpeningBalance ?? 0));
  form.append("amount_tolerance", String(settings.amountTolerance ?? 0.01));
  form.append("date_window_days", String(settings.dateWindowDays ?? 3));

  let slowTimer;
  if (onSlow) {
    slowTimer = setTimeout(onSlow, 4000);
  }

  let resp;
  try {
    resp = await fetch(`${base}/api/reconcile`, { method: "POST", body: form });
  } catch {
    throw new ApiError(
      `Couldn't reach the API at ${base}. Check the API URL in Settings and that the backend is running.`,
      0
    );
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
  }

  if (!resp.ok) {
    let detail = `Request failed (${resp.status}).`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore parse errors, fall back to generic message */
    }
    throw new ApiError(detail, resp.status);
  }

  return resp.json();
}

export async function fetchSampleCsv(which) {
  // Sample CSVs are bundled with the frontend itself, so "load sample data"
  // works even before you've deployed/pointed at a backend.
  const resp = await fetch(`/sample-data/${which === "vendor" ? "vendor_statement" : "internal_ledger"}.csv`);
  if (!resp.ok) throw new Error(`Could not load sample ${which} file.`);
  const text = await resp.text();
  const filename = which === "vendor" ? "vendor_statement.csv" : "internal_ledger.csv";
  return new File([text], filename, { type: "text/csv" });
}

export async function checkHealth() {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(6000) });
    return resp.ok;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
