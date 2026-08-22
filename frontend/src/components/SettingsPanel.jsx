import { useState } from "react";
import { DEFAULT_API_URL } from "../lib/api";
import "./SettingsPanel.css";

export default function SettingsPanel({ open, settings, onChange, apiUrl, onApiUrlChange }) {
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);

  if (!open) return null;

  const num = (key) => (e) => onChange({ ...settings, [key]: e.target.value === "" ? "" : Number(e.target.value) });

  return (
    <div className="settings">
      <div className="container settings__grid">
        <div className="settings__group">
          <h3 className="settings__heading">Matching tolerances</h3>
          <label className="settings__field">
            <span>Amount tolerance ($)</span>
            <input type="number" step="0.01" min="0" value={settings.amountTolerance} onChange={num("amountTolerance")} />
          </label>
          <label className="settings__field">
            <span>Date window (days)</span>
            <input type="number" step="1" min="0" value={settings.dateWindowDays} onChange={num("dateWindowDays")} />
          </label>
          <p className="settings__help">
            Used for the amount + date + description fallback match, when no reliable reference is present on both sides.
          </p>
        </div>

        <div className="settings__group">
          <h3 className="settings__heading">Opening balances</h3>
          <label className="settings__field">
            <span>Vendor statement</span>
            <input type="number" step="0.01" value={settings.vendorOpeningBalance} onChange={num("vendorOpeningBalance")} />
          </label>
          <label className="settings__field">
            <span>Internal ledger</span>
            <input type="number" step="0.01" value={settings.ledgerOpeningBalance} onChange={num("ledgerOpeningBalance")} />
          </label>
          <p className="settings__help">Starting point for each running-balance chart.</p>
        </div>

        <div className="settings__group">
          <h3 className="settings__heading">Backend</h3>
          <label className="settings__field">
            <span>API base URL</span>
            <input
              type="text"
              value={localApiUrl}
              placeholder={DEFAULT_API_URL}
              onChange={(e) => setLocalApiUrl(e.target.value)}
              onBlur={() => onApiUrlChange(localApiUrl)}
            />
          </label>
          <p className="settings__help">
            Point this at your deployed Render URL, e.g. <span className="mono">https://your-api.onrender.com</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
