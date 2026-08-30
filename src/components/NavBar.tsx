import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Today", end: true },
  { to: "/week", label: "Week", end: false },
  { to: "/progress", label: "Progress", end: false },
  { to: "/more", label: "More", end: false },
];

export default function NavBar() {
  return (
    <nav className="nav-bar">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
