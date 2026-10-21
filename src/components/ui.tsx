import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes
} from "react";
import { ArrowUp, Search, X } from "lucide-react";
import type { QuestionType } from "../types";
import { DIFFICULTY_LABEL, typeLabel, typeTone } from "../lib/constants";
import { cn } from "../lib/text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet" | "ink";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonClass = (options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}) =>
  cn(
    "btn",
    `btn-${options.variant ?? "primary"}`,
    `btn-${options.size ?? "md"}`,
    options.block && "btn-block",
    options.className
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  icon,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  variant?: "plain" | "outline";
  children: ReactNode;
}

export function IconButton({ label, size = "md", variant = "outline", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn("icon-btn", `icon-btn-${size}`, `icon-btn-${variant}`, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export interface SectionHeadProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  id?: string;
}

export function SectionHead({ icon, title, hint, action, id }: SectionHeadProps) {
  return (
    <div className="section-head" id={id}>
      {icon ? <span className="section-glyph">{icon}</span> : null}
      <div className="section-copy">
        <h2>{title}</h2>
        {hint ? <p>{hint}</p> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : <span className="section-rule" aria-hidden="true" />}
    </div>
  );
}

export interface SectionNavItem {
  id: string;
  label: string;
}

/**
 * 长页面页内导航：粘在视口顶部，点击平滑滚动到对应 SectionHead。
 * 使用 IntersectionObserver 同步当前区块，右侧提供回到顶部。
 */
export function SectionNav({ items, label = "页内快速跳转" }: { items: SectionNavItem[]; label?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const lockUntil = useRef(0);
  const ids = items.map((item) => item.id).join("|");

  useEffect(() => {
    const elements = ids
      .split("|")
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length || typeof IntersectionObserver === "undefined") return;
    setActive(elements[0].id);
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockUntil.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActive((first.target as HTMLElement).id);
      },
      { rootMargin: "-92px 0px -60% 0px", threshold: 0 }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ids]);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = element.getBoundingClientRect().top + window.scrollY - 92;
    lockUntil.current = Date.now() + 900;
    setActive(id);
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  };

  if (!items.length) return null;

  return (
    <nav className="section-nav" aria-label={label}>
      <div className="section-nav-scroll">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("section-nav-item", active === item.id && "is-active")}
            aria-current={active === item.id ? "true" : undefined}
            onClick={() => scrollTo(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="section-nav-top"
        aria-label="回到顶部"
        title="回到顶部"
        onClick={() => {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          lockUntil.current = Date.now() + 900;
          window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
          setActive(items[0].id);
        }}
      >
        <ArrowUp />
      </button>
    </nav>
  );
}

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, subtitle, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn("page-head", className)}>
      {back ? <div className="page-head-back">{back}</div> : null}
      <div className="page-head-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="page-head-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </header>
  );
}

export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: "default" | "jade" | "rose" | "gold";
  title?: string;
  disabled?: boolean;
}

export function Chip({ active, onClick, children, tone = "default", title, disabled }: ChipProps) {
  const className = cn("chip", `chip-${tone}`, active && "is-active");
  if (!onClick) return <span className={className} title={title}>{children}</span>;
  return (
    <button type="button" className={className} onClick={onClick} title={title} aria-pressed={active} disabled={disabled}>
      {children}
    </button>
  );
}

export function TypeBadge({ type, count }: { type: QuestionType; count?: number }) {
  return (
    <span className={cn("type-badge", `tone-${typeTone[type]}`)}>
      {typeLabel[type]}
      {typeof count === "number" ? <b>{count}</b> : null}
    </span>
  );
}

export function DifficultyDots({ value, label = false }: { value: number; label?: boolean }) {
  const level = Math.min(5, Math.max(1, Math.round(value)));
  return (
    <span className="difficulty" title={`难度：${DIFFICULTY_LABEL[level] ?? level}`}>
      <span className="difficulty-dots" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((dot) => (
          <i key={dot} className={dot <= level ? "on" : ""} />
        ))}
      </span>
      {label ? <small>{DIFFICULTY_LABEL[level] ?? `${level} 级`}</small> : null}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "jade",
  size = "md",
  label
}: {
  value: number;
  tone?: "jade" | "rose" | "gold" | "blue";
  size?: "sm" | "md";
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      className={cn("progress", `progress-${size}`, `progress-${tone}`)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 128,
  stroke = 8,
  children,
  tone = "jade"
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  tone?: "jade" | "gold";
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("ring", `ring-${tone}`)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-content">{children}</div>
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: "jade" | "rose" | "gold" | "blue";
  icon?: ReactNode;
}

export function StatCard({ label, value, unit, hint, tone, icon }: StatCardProps) {
  return (
    <div className={cn("stat-card", tone && `stat-${tone}`)}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon ? <span className="stat-icon">{icon}</span> : null}
      </div>
      <div className="stat-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel = "搜索",
  onClear
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onClear?: () => void;
}) {
  return (
    <div className="search-field">
      <Search aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
            onClear?.();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          className="search-clear"
          aria-label="清空搜索"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
        >
          <X />
        </button>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label className={cn("field", error && "has-error", className)} htmlFor={htmlFor}>
      <span className="field-label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("text-input", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("text-area", props.className)} />;
}

export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn("switch", checked && "is-on")}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  label
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label="减少">
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label="增加">
        +
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const move = (event: ReactKeyboardEvent<HTMLButtonElement>, direction: 1 | -1) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + direction + options.length) % options.length];
    if (next) {
      onChange(next.value);
      const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".segment");
      buttons?.[options.indexOf(next)]?.focus();
    }
  };

  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          className={cn("segment", value === option.value && "is-active")}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => move(event, event.key === "ArrowRight" ? 1 : -1)}
        >
          {option.icon}
          <span>{option.label}</span>
          {option.badge ? <b>{option.badge}</b> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function InlineNotice({
  tone = "info",
  children
}: {
  tone?: "info" | "warn" | "success";
  children: ReactNode;
}) {
  return <div className={cn("notice", `notice-${tone}`)}>{children}</div>;
}
