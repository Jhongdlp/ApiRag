"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, Info, Loader2, X } from "lucide-react";

// ─── cx helper ──────────────────────────────────────────────────────────────

export function cx(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<
  string,
  { label: string; cls: string; spin?: boolean }
> = {
  ready:      { label: "Listo",      cls: "text-emerald-300 border-emerald-500/40" },
  error:      { label: "Error",      cls: "text-red-300 border-red-500/40" },
  processing: { label: "Procesando", cls: "text-blue-300 border-blue-500/40", spin: true },
  queued:     { label: "En cola",    cls: "text-muted border-white/15" },
  indexing:   { label: "Indexando",  cls: "text-blue-300 border-blue-500/40", spin: true },
};

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_MAP[status] ?? STATUS_MAP.queued;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold border",
        m.cls
      )}
    >
      {m.spin ? (
        <Loader2 size={10} className="spin-slow" />
      ) : (
        <span
          className={cx(
            "w-1.5 h-1.5",
            status === "ready"
              ? "bg-emerald-400"
              : status === "error"
              ? "bg-red-400"
              : "bg-muted"
          )}
        />
      )}
      {m.label}
    </span>
  );
}

// ─── Trend ───────────────────────────────────────────────────────────────────

export function Trend({ value }: { value?: number | null }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular",
        up ? "text-emerald-300" : "text-red-300"
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "gold" | "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BTN_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px] tracking-wider gap-1.5",
  md: "h-9 px-4 text-xs tracking-wider gap-2",
};
const BTN_VARIANTS: Record<ButtonVariant, string> = {
  gold:    "bg-gold text-black font-semibold hover:bg-amber-400",
  primary: "bg-white text-black font-semibold hover:bg-white/90",
  outline: "border border-white/15 hover:border-white/40 text-white",
  ghost:   "text-muted hover:text-white",
  danger:  "bg-red-500 text-white font-semibold hover:bg-red-400",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export function Button({
  variant = "ghost",
  size = "md",
  className = "",
  children,
  icon: IconLeft,
  iconRight: IconRight,
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 13 : 14;
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center uppercase font-medium transition-colors",
        BTN_SIZES[size],
        BTN_VARIANTS[variant],
        className
      )}
    >
      {IconLeft && <IconLeft size={iconSize} strokeWidth={1.5} />}
      {children}
      {IconRight && <IconRight size={iconSize} strokeWidth={1.5} />}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  wrapperClassName?: string;
}

export function Input({
  icon: IconComp,
  className = "",
  wrapperClassName = "",
  ...rest
}: InputProps) {
  return (
    <div className={cx("relative", wrapperClassName)}>
      {IconComp && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none">
          <IconComp size={14} strokeWidth={1.5} />
        </span>
      )}
      <input
        {...rest}
        className={cx(
          "w-full h-9 bg-transparent border border-hairline text-sm text-white placeholder:text-dim",
          "focus:outline-none focus:border-white/30 transition-colors",
          IconComp ? "pl-9 pr-3" : "px-3",
          className
        )}
      />
    </div>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export function Select({
  children,
  className = "",
  wrapperClassName = "",
  ...rest
}: SelectProps) {
  return (
    <div className={cx("relative inline-block", wrapperClassName)}>
      <select
        {...rest}
        className={cx(
          "appearance-none h-9 bg-ink border border-hairline text-sm text-white pl-3 pr-8",
          "focus:outline-none focus:border-white/30",
          className
        )}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-dim">
        <ChevronDown size={14} strokeWidth={1.5} />
      </span>
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  size = 36,
}: {
  name: string;
  size?: number;
}) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="bg-surface border border-hairline grid place-items-center text-white font-semibold shrink-0 tracking-tight"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
}

interface ToastCtx {
  push: (t: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastCtx>({ push: () => {} });

const TOAST_TONE: Record<
  ToastType,
  { color: string; icon: React.ReactNode; bar: string }
> = {
  success: { color: "text-emerald-300", icon: <Check size={14} />, bar: "bg-emerald-400" },
  error:   { color: "text-red-300",     icon: <X size={14} />,     bar: "bg-red-400" },
  info:    { color: "text-blue-300",    icon: <Info size={14} />,  bar: "bg-blue-400" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((xs) => [...xs, { id, ...t }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const tone = TOAST_TONE[t.type];
          return (
            <div
              key={t.id}
              className="animate-slide-in pointer-events-auto min-w-[300px] max-w-sm bg-paper border border-hairline flex"
            >
              <div className={cx("w-1", tone.bar)} />
              <div className="flex items-start gap-3 p-3.5 flex-1">
                <span className={cx("mt-0.5", tone.color)}>{tone.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{t.title}</div>
                  {t.body && (
                    <div className="text-xs text-muted mt-0.5">{t.body}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ─── ConfirmModal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Eliminar",
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-paper border border-hairline">
        <div className="px-6 pt-6">
          <div className="eyebrow text-red-300">Confirmar acción</div>
          <h3 className="mt-2 text-lg font-semibold text-white tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
        </div>
        <div className="h-px w-full bg-hairline mt-6" />
        <div className="px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  className?: string;
}

export function EmptyState({
  icon: IconComp,
  title,
  body,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      <div className="w-12 h-12 border border-hairline grid place-items-center text-dim mb-4">
        <IconComp size={22} strokeWidth={1.5} />
      </div>
      <div className="text-sm font-medium text-white">{title}</div>
      {body && (
        <div className="text-xs text-muted mt-1.5 max-w-xs leading-relaxed">
          {body}
        </div>
      )}
    </div>
  );
}

// ─── useCountUp ──────────────────────────────────────────────────────────────

export function useCountUp(target: number, duration = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf: number;
    let start: number | undefined;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  index: number;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionHeader({ index, title, sub, right }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-hairline">
      <div className="flex items-baseline gap-4 min-w-0">
        <span className="font-mono text-[11px] text-dim tabular shrink-0">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="text-[15px] font-semibold text-white tracking-tight">
          {title}
        </h3>
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}

// ─── PageHeader ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  section: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}

export function PageHeader({ section, title, sub, right }: PageHeaderProps) {
  const fmt = new Date()
    .toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

  return (
    <header className="pt-4 pb-4 sm:pt-8 sm:pb-8 border-b border-hairline">
      {/* ── Metadata row ── */}
      <div className="flex items-center justify-between gap-3 mb-2 sm:mb-4">
        <div className="flex items-baseline gap-2 sm:gap-4 min-w-0">
          {/* Date: desktop only */}
          <span className="font-mono text-[11px] text-dim tabular hidden sm:inline shrink-0">
            {fmt}
          </span>
          <span className="w-3 h-px bg-dim inline-block hidden sm:inline-block shrink-0" />
          <span className="eyebrow text-muted truncate">{section}</span>
        </div>
        {/* Buttons: mobile only — appear inline with section label */}
        {right && (
          <div className="flex items-center gap-1.5 sm:hidden shrink-0">{right}</div>
        )}
      </div>

      {/* ── Title row ── */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="display text-[26px] sm:text-[44px] font-bold text-white leading-tight sm:leading-[0.95]">
            {title}
          </h1>
          {sub && (
            <div className="mt-1.5 sm:mt-3 text-xs sm:text-sm text-muted leading-snug">
              {sub}
            </div>
          )}
        </div>
        {/* Buttons: desktop only — aligned with title */}
        {right && (
          <div className="hidden sm:flex items-center gap-2 flex-wrap shrink-0">
            {right}
          </div>
        )}
      </div>
    </header>
  );
}
