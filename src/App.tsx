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
import Money from "./pages/Money";
import MoneySetup from "./pages/MoneySetup";
import Market from "./pages/Market";
import Session from "./pages/Session";
import { useAppData } from "./store/store";

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

export default function App() {
  useTheme();

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/week" element={<Week />} />
          <Route path="/program" element={<Program />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/history" element={<History />} />
          <Route path="/money" element={<Money />} />
          <Route path="/money/setup" element={<MoneySetup />} />
          <Route path="/market" element={<Market />} />
          <Route path="/more" element={<More />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route element={<Layout withNav={false} />}>
          <Route path="/session" element={<Session />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
