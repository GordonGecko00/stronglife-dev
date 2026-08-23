import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
        Today
      </NavLink>
      <NavLink to="/schedule" className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
        Plan
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
        History
      </NavLink>
    </nav>
  );
}
