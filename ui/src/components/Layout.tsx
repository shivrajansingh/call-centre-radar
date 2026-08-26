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
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-[var(--sidebar-grad)] max-md:w-16">
        <div className="flex items-center gap-2.5 px-4 py-5 pb-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-white shadow-[0_4px_14px_rgba(56,189,248,.35)]">
            <Radar size={20} />
          </span>
          <span className="flex flex-col leading-tight max-md:hidden">
            <b className="text-sm">Call-Centre</b>
            <span className="text-[11px] text-dim">Radar</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2.5 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors max-md:justify-center ${isActive
                  ? "border border-accent/25 bg-gradient-to-r from-accent/14 to-accent2/8 text-accent"
                  : "border border-transparent text-dim hover:bg-hover hover:text-ink"}`}>
              <Icon size={17} />
              <span className="max-md:hidden">{label}</span>
            </NavLink>
          ))}
          {isManager && (
            <NavLink to="/upload"
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors max-md:justify-center ${isActive
                  ? "border border-accent/25 bg-gradient-to-r from-accent/14 to-accent2/8 text-accent"
                  : "border border-transparent text-dim hover:bg-hover hover:text-ink"}`}>
              <UploadCloud size={17} />
              <span className="max-md:hidden">Upload</span>
            </NavLink>
          )}
          {me?.role === "admin" && (
            <NavLink to="/users"
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors max-md:justify-center ${isActive
                  ? "border border-accent/25 bg-gradient-to-r from-accent/14 to-accent2/8 text-accent"
                  : "border border-transparent text-dim hover:bg-hover hover:text-ink"}`}>
              <ShieldCheck size={17} />
              <span className="max-md:hidden">Users</span>
            </NavLink>
          )}
        </nav>

        <div className="border-t border-line p-3.5">
          <span className="inline-block rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-accent max-md:hidden">
            {me?.role}
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/80 px-6 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 text-dim">
            <UserRound size={18} className="shrink-0" />
            <span className="truncate">{me?.name}</span>
            <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{me?.role}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface2 text-dim transition-colors hover:border-accent hover:text-accent"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div className="relative">
              <button
                className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-accent2 to-purple-400 text-[13px] font-bold text-white"
                onClick={() => setMenuOpen(o => !o)}>
                {(me?.name ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 z-30 min-w-[180px] rounded-xl border border-line2 bg-surface2 p-1.5 shadow-[var(--shadow)]">
                  <div className="mb-1 flex flex-col border-b border-line px-2.5 py-2">
                    <b className="text-ink">{me?.name}</b>
                    <span className="text-xs text-dim">{me?.username}</span>
                  </div>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-bad hover:bg-bad/10"
                    onClick={() => { logout(); navigate("/login"); }}>
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="w-full px-6 py-6 max-md:px-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}