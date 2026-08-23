import { HashRouter, Routes, Route, Outlet } from "react-router-dom";
import NavBar from "./components/NavBar";
import Today from "./pages/Today";
import Schedule from "./pages/Schedule";
import History from "./pages/History";
import Session from "./pages/Session";

function Layout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <NavBar />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/history" element={<History />} />
        </Route>
        <Route path="/session" element={<Session />} />
      </Routes>
    </HashRouter>
  );
}
