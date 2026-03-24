import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Accordion from "../components/layout/Accordion";
import TimerCard from "../components/timer/TimerCard";
import LabelsSection from "../components/labels/LabelsSection";
import HistorySection from "../components/history/HistorySection";
import StatsSection from "../components/stats/StatsSection";

export default function MainPage() {
  const { user, apiFetch, logout } = useAuth();
  const { icon, cycleTheme } = useTheme();
  const [labels, setLabels] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const [labelsRes, activeRes] = await Promise.all([
          apiFetch("/labels"),
          apiFetch("/event/active"),
        ]);
        const labelsData = await labelsRes.json();
        const activeData = await activeRes.json();
        setLabels(labelsData.labels || []);
        setActiveEvent(activeData.event || null);
      } catch (e) {
        // Unauthorized handled by apiFetch
      }
    }
    init();
  }, [apiFetch]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <div className="wordmark">LifeLogger</div>
          <h1>{user?.display_name || "LifeLogger"}</h1>
        </div>
        <div className="header-actions">
          <button className="header-btn icon-only" onClick={cycleTheme} title="Switch theme">
            {icon}
          </button>
          {user?.is_admin && (
            <Link className="header-btn" to="/admin">Admin</Link>
          )}
          <Link className="header-btn" to="/settings">Settings</Link>
          <button className="header-btn" onClick={logout}>Sign out</button>
        </div>
      </header>

      <TimerCard
        labels={labels}
        activeEvent={activeEvent}
        onEventChange={setActiveEvent}
      />

      <Accordion title="Labels" icon="🏷">
        <LabelsSection labels={labels} onLabelsChange={setLabels} />
      </Accordion>

      <Accordion title="History" icon="📋">
        <HistorySection labels={labels} />
      </Accordion>

      <Accordion title="Statistics" icon="📊">
        <StatsSection />
      </Accordion>
    </div>
  );
}
