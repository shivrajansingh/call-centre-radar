import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Headset, LayoutDashboard, LogOut, Moon, PhoneCall, Radar, ShieldCheck,
  Sun, UploadCloud, UserRound, Users,
} from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/calls", label: "Calls", icon: PhoneCall },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/agents", label: "Agents", icon: Headset },
];

export default function Layout() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const isManager = me?.role === "manager" || me?.role === "admin";

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><Radar size={20} /></span>
          <span className="brand-text">
            <b>Call-Centre</b>
            <span>Radar</span>
          </span>
        </div>
        <nav className="side-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
          {isManager && (
            <NavLink to="/upload" className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <UploadCloud size={17} />
              <span>Upload</span>
            </NavLink>
          )}
          {me?.role === "admin" && (
            <NavLink to="/users" className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <ShieldCheck size={17} />
              <span>Users</span>
            </NavLink>
          )}
        </nav>
        <div className="side-foot">
          <div className="role-chip">{me?.role}</div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title">
            <UserRound size={18} />
            <span>{me?.name}</span>
            <span className="topbar-role">{me?.role}</span>
          </div>
          <div className="topbar-menu">
            <button className="theme-btn" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggle}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button className="avatar-btn" onClick={() => setMenuOpen(o => !o)}>
              {(me?.name ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
            </button>
            {menuOpen && (
              <div className="user-menu">
                <div className="user-menu-head">
                  <b>{me?.name}</b>
                  <span>{me?.username}</span>
                </div>
                <button className="user-menu-item" onClick={() => { logout(); navigate("/login"); }}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}