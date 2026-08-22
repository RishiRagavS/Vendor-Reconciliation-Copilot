import { useCallback, useId, useState } from "react";
import SparkleField from "./SparkleField";
import "./UploadPonds.css";

const POND_SPARKLES = [
  { top: "2%", left: "10%", size: 24, delay: "0.4s" },
  { top: "8%", left: "88%", size: 18, delay: "1.6s", color: "koi" },
];

function Pond({ label, hint, file, onFile, accent, disabled }) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList) => {
      const f = fileList?.[0];
      if (!f) return;
      onFile(f);
    },
    [onFile]
  );

  return (
    <div className={`pond pond--${accent}`}>
      <label
        htmlFor={inputId}
        className={`pond__zone ${dragOver ? "pond__zone--drag" : ""} ${file ? "pond__zone--filled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="pond__ring" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" />
          </svg>
        </span>
        <span className="pond__content">
          {file ? (
            <>
              <CheckIcon />
              <span className="pond__filename">{file.name}</span>
              <span className="pond__swap">Click or drop to replace</span>
            </>
          ) : (
            <>
              <DropIcon />
              <span className="pond__cta">Drop CSV here</span>
              <span className="pond__swap">or click to browse</span>
            </>
          )}
        </span>
      </label>
      <div className="pond__label">{label}</div>
      <div className="pond__hint">{hint}</div>
    </div>
  );
}

function DropIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12M12 15l-4.5-4.5M12 15l4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 18.5c0 1.4 1.1 2.5 2.5 2.5h11c1.4 0 2.5-1.1 2.5-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function UploadPonds({
  vendorFile,
  ledgerFile,
  onVendorFile,
  onLedgerFile,
  onRun,
  onLoadSample,
  loading,
  slow,
  error,
  onToggleSettings,
  settingsOpen,
}) {
  const canRun = Boolean(vendorFile && ledgerFile) && !loading;

  return (
    <section className="ponds">
      <SparkleField points={POND_SPARKLES} />
      <div className="container">
        <div className="ponds__row">
          <Pond
            label="Vendor statement"
            hint="Statement of account from the vendor"
            file={vendorFile}
            onFile={onVendorFile}
            accent="gold"
            disabled={loading}
          />
          <div className="ponds__link" aria-hidden="true">
            <svg width="72" height="28" viewBox="0 0 72 28">
              <path d="M2 14h48" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 6" strokeLinecap="round" fill="none" />
              <path d="M42 5l12 9-12 9" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <Pond
            label="Internal ledger"
            hint="Your accounts-payable extract"
            file={ledgerFile}
            onFile={onLedgerFile}
            accent="koi"
            disabled={loading}
          />
        </div>

        <div className="ponds__actions">
          <button className="btn btn--primary" onClick={onRun} disabled={!canRun}>
            {loading ? (slow ? "Waking up the server…" : "Reconciling…") : "Run reconciliation →"}
          </button>
          <button className="btn btn--ghost" onClick={onLoadSample} disabled={loading}>
            Load sample data
          </button>
          <button className="ponds__settings-toggle" onClick={onToggleSettings} aria-expanded={settingsOpen}>
            <GearIcon /> Settings
          </button>
        </div>

        {slow && loading && (
          <p className="ponds__note">
            The free-tier backend spins down when idle — it can take up to a minute to wake up. Hang tight.
          </p>
        )}

        {error && <div className="ponds__error" role="alert">{error}</div>}
      </div>
    </section>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h11M18 6h2M6 12h2M11 12h11M4 18h14M21 18h-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="15" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
