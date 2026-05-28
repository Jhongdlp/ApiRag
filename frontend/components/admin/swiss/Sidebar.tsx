"use client";

import {
  Activity,
  BarChart3,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Settings2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, cx } from "./ui";

export type Page =
  | "overview"
  | "documents"
  | "conversations"
  | "analytics"
  | "evaluation"
  | "system"
  | "settings";

interface NavItem {
  id: Page;
  label: string;
  Icon: LucideIcon;
  badge?: number;
}

const NAV: NavItem[] = [
  { id: "overview",      label: "Overview",         Icon: LayoutDashboard },
  { id: "documents",     label: "Documentos",       Icon: FileText, badge: 0 },
  { id: "conversations", label: "Conversaciones",   Icon: MessagesSquare },
  { id: "analytics",     label: "Analítica",        Icon: BarChart3 },
  { id: "evaluation",    label: "Evaluación RAGAS", Icon: FlaskConical },
];

const NAV_SYS: NavItem[] = [
  { id: "system",   label: "Estado del Sistema", Icon: Activity },
  { id: "settings", label: "Configuración",      Icon: Settings2 },
];

interface SidebarProps {
  current: Page;
  onNav: (page: Page) => void;
  email: string;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

// ─── Shared sidebar body ──────────────────────────────────────────────────────

function SidebarBody({
  current,
  onNav,
  email,
  onLogout,
  showClose,
  onClose,
}: {
  current: Page;
  onNav: (page: Page) => void;
  email: string;
  onLogout: () => void;
  showClose?: boolean;
  onClose?: () => void;
}) {
  const name = email.split("@")[0] ?? "Admin";

  return (
    <>
      {/* Logo */}
      <div className="px-5 pt-7 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-white text-[18px] tracking-tighter">
                UTI
              </span>
              <span className="w-1 h-1 bg-gold inline-block" />
              <span className="text-white font-medium text-[12px] uppercase tracking-[0.18em]">
                RAG
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted">
              <span className="font-mono uppercase tracking-wider">v1.0</span>
              <span className="w-0.5 h-0.5 bg-dim inline-block" />
              <span className="font-mono uppercase tracking-wider text-gold">Beta</span>
            </div>
          </div>
          {showClose && (
            <button
              onClick={onClose}
              className="text-muted hover:text-white transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-hairline" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scroll-thin py-5">
        <NavSection label="Navegación">
          {NAV.map((item, i) => (
            <NavItemBtn
              key={item.id}
              item={item}
              index={i + 1}
              active={current === item.id}
              onClick={() => onNav(item.id)}
            />
          ))}
        </NavSection>

        <div className="h-px w-full bg-hairline my-5" />

        <NavSection label="Sistema">
          {NAV_SYS.map((item, i) => (
            <NavItemBtn
              key={item.id}
              item={item}
              index={NAV.length + i + 1}
              active={current === item.id}
              onClick={() => onNav(item.id)}
            />
          ))}
        </NavSection>
      </nav>

      <div className="h-px w-full bg-hairline" />

      {/* User */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-white truncate capitalize">
              {name}
            </div>
            <div className="text-[10px] text-muted truncate font-mono">{email}</div>
          </div>
          <span className="w-1.5 h-1.5 bg-emerald-400 shrink-0" />
        </div>
        <button
          onClick={onLogout}
          className="mt-3 w-full h-7 text-[10px] uppercase tracking-[0.18em] text-muted hover:text-white border border-hairline hover:border-white/30 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <LogOut size={11} strokeWidth={1.5} /> Cerrar sesión
        </button>
      </div>
    </>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export default function Sidebar({
  current,
  onNav,
  email,
  onLogout,
  isOpen = false,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Desktop: sticky sidebar (lg+) */}
      <aside className="hidden lg:flex h-screen sticky top-0 shrink-0 w-[220px] border-r border-hairline bg-ink flex-col">
        <SidebarBody
          current={current}
          onNav={onNav}
          email={email}
          onLogout={onLogout}
        />
      </aside>

      {/* Mobile: slide-over drawer (below lg) */}
      <div
        className={cx(
          "lg:hidden fixed inset-0 z-50",
          !isOpen && "pointer-events-none"
        )}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div
          className={cx(
            "absolute inset-0 bg-black/60 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />
        {/* Drawer panel */}
        <aside
          className={cx(
            "absolute left-0 top-0 bottom-0 w-[280px] bg-ink border-r border-hairline flex flex-col",
            "transition-transform duration-300 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarBody
            current={current}
            onNav={onNav}
            email={email}
            onLogout={onLogout}
            showClose
            onClose={onClose}
          />
        </aside>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5">
      <div className="eyebrow mb-3 text-dim">{label}</div>
      <ul className="space-y-px">{children}</ul>
    </div>
  );
}

function NavItemBtn({
  item,
  index,
  active,
  onClick,
}: {
  item: NavItem;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const { Icon } = item;
  return (
    <li>
      <button
        onClick={onClick}
        className={cx(
          "group relative w-full flex items-center gap-3 py-2 transition-colors",
          active ? "text-white" : "text-muted hover:text-white"
        )}
      >
        {active && (
          <span className="absolute -left-5 top-0 bottom-0 w-[2px] bg-gold" />
        )}
        <span className="font-mono text-[10px] text-dim tabular w-5 shrink-0">
          {String(index).padStart(2, "0")}
        </span>
        <Icon
          size={14}
          strokeWidth={1.5}
          className={cx(
            active ? "text-gold" : "text-dim group-hover:text-muted"
          )}
        />
        <span
          className={cx("text-[13px] flex-1 text-left", active && "font-medium")}
        >
          {item.label}
        </span>
        {item.badge != null && item.badge > 0 && (
          <span
            className={cx(
              "text-[10px] font-mono px-1 py-0.5 tabular",
              active
                ? "bg-gold text-black"
                : "border border-hairline text-muted"
            )}
          >
            {item.badge}
          </span>
        )}
      </button>
    </li>
  );
}
