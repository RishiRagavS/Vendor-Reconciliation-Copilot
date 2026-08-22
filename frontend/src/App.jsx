import { useRef, useState } from "react";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import UploadPonds from "./components/UploadPonds";
import SettingsPanel from "./components/SettingsPanel";
import SummaryCard from "./components/SummaryCard";
import StatBadges from "./components/StatBadges";
import ReconciliationCheck from "./components/ReconciliationCheck";
import DiscrepancyList from "./components/DiscrepancyList";
import RunningBalanceChart from "./components/RunningBalanceChart";
import MatchesTable from "./components/MatchesTable";
import Footer from "./components/Footer";
import Sparkle from "./components/Sparkle";
import { reconcile, fetchSampleCsv, getApiBaseUrl, setApiBaseUrl, ApiError } from "./lib/api";
import "./App.css";

const DEFAULT_SETTINGS = {
  vendorOpeningBalance: 0,
  ledgerOpeningBalance: 0,
  amountTolerance: 0.01,
  dateWindowDays: 3,
};

export default function App() {
  const [vendorFile, setVendorFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [apiUrl, setApiUrlState] = useState(getApiBaseUrl());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const resultsRef = useRef(null);

  const handleApiUrlChange = (url) => {
    setApiBaseUrl(url);
    setApiUrlState(getApiBaseUrl());
  };

  async function runReconciliation(vFile, lFile) {
    setLoading(true);
    setSlow(false);
    setError(null);
    try {
      const data = await reconcile({
        vendorFile: vFile,
        ledgerFile: lFile,
        settings,
        onSlow: () => setSlow(true),
      });
      setResult(data);
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong running the reconciliation.";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
      setSlow(false);
    }
  }

  const handleRun = () => {
    if (!vendorFile || !ledgerFile) return;
    runReconciliation(vendorFile, ledgerFile);
  };

  const handleLoadSample = async () => {
    setError(null);
    try {
      const [v, l] = await Promise.all([fetchSampleCsv("vendor"), fetchSampleCsv("ledger")]);
      setVendorFile(v);
      setLedgerFile(l);
      runReconciliation(v, l);
    } catch {
      setError("Couldn't load the sample CSVs.");
    }
  };

  return (
    <div className="app-shell">
      <Hero />
      <HowItWorks />
      <UploadPonds
        vendorFile={vendorFile}
        ledgerFile={ledgerFile}
        onVendorFile={setVendorFile}
        onLedgerFile={setLedgerFile}
        onRun={handleRun}
        onLoadSample={handleLoadSample}
        loading={loading}
        slow={slow}
        error={error}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        settingsOpen={settingsOpen}
      />
      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        apiUrl={apiUrl}
        onApiUrlChange={handleApiUrlChange}
      />

      {result && (
        <section className="results container" ref={resultsRef}>
          <SummaryCard summary={result.summary} totals={result.totals} check={result.reconciliation_check} />
          <StatBadges totals={result.totals} />
          <ReconciliationCheck totals={result.totals} check={result.reconciliation_check} />

          <h2 className="results__heading">
            <Sparkle size={14} className="results__heading-spark" /> Discrepancies
          </h2>
          <DiscrepancyList discrepancies={result.discrepancies} />

          <RunningBalanceChart vendorSeries={result.running_balance.vendor} ledgerSeries={result.running_balance.ledger} />
          <MatchesTable matches={result.matches} />
        </section>
      )}

      <Footer />
    </div>
  );
}
