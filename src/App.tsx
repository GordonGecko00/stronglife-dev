import { useEffect } from "react";
import { HashRouter, Routes, Route, Outlet } from "react-router-dom";
import NavBar from "./components/NavBar";
import RestBar from "./components/RestBar";
import Today from "./pages/Today";
import Week from "./pages/Week";
import Program from "./pages/Program";
import Progress from "./pages/Progress";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Milestones from "./pages/Milestones";
import More from "./pages/More";
import Session from "./pages/Session";
import Day from "./pages/Day";
import Onboarding from "./pages/Onboarding";
import Guide from "./pages/Guide";
import { useAppData } from "./store/store";
import { Navigate, useLocation } from "react-router-dom";

function Layout({ withNav = true }: { withNav?: boolean }) {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <RestBar />
      {withNav && <NavBar />}
    </div>
  );
}

/** Mirror the saved theme onto the document so CSS can key off it. */
function useTheme() {
  const theme = useAppData().settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
}

/** Send first-time users through setup before anything else. */
function OnboardingGate() {
  const onboardedAt = useAppData().onboardedAt;
  const location = useLocation();
  if (!onboardedAt && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }
  return null;
}

export default function App() {
  useTheme();

  return (
    <HashRouter>
      <OnboardingGate />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/week" element={<Week />} />
          <Route path="/day/:key" element={<Day />} />
          <Route path="/program" element={<Program />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/history" element={<History />} />
          <Route path="/more" element={<More />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route element={<Layout withNav={false} />}>
          <Route path="/session" element={<Session />} />
          <Route path="/session/:sessionId" element={<Session />} />
          <Route path="/welcome" element={<Onboarding />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
