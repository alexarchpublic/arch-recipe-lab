"use client";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export const btn = {
  primary:
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-extrabold text-primary-foreground transition hover:brightness-110 disabled:opacity-60",
  secondary:
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-navy bg-card px-5 text-sm font-extrabold text-navy transition hover:bg-tint disabled:opacity-60",
  onDark:
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-white/[0.28] px-5 text-sm font-extrabold text-white transition hover:bg-white/10",
  link: "font-semibold text-primary underline-offset-4 hover:underline",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btn }) {
  return <button type="button" className={`${btn[variant]} ${className}`} {...rest} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const control =
  "min-h-[48px] w-full rounded-md border border-line-strong bg-card px-3.5 text-[15px] text-navy placeholder:text-ink-muted focus:border-primary";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${control} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

/**
 * The email notice under each capture form (fixes PRD, fix 6, Alex 13 Nov):
 * everyone who leaves an email gets the campaigns, so there is no tickbox.
 */
export function Notice({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs leading-snug text-muted-foreground ${className}`}>{children}</p>;
}

export function Check({ checked, onChange, name, children }: { checked: boolean; onChange: (v: boolean) => void; name?: string; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[hsl(var(--primary))]" />
      <span>{children}</span>
    </label>
  );
}

/** Dollar amount typed by the visitor; reports positive numbers only. */
export function MoneyInput({ value, onChange, id, label, large = false }: { value: number | null; onChange: (n: number | null) => void; id?: string; label: string; large?: boolean }) {
  const text = value && value > 0 ? Math.round(value).toLocaleString("en-US") : "";
  return (
    <div className="relative">
      <span className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-semibold text-navy ${large ? "text-[22px]" : "text-lg"}`}>$</span>
      <input
        id={id}
        aria-label={label}
        inputMode="numeric"
        defaultValue={text}
        key={text === "" ? "empty" : "set"}
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
        onBlur={(e) => {
          const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
          e.target.value = Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-US") : "";
        }}
        placeholder="100,000"
        className={`${control} pl-8 font-mono font-semibold tabular-nums ${large ? "min-h-[56px] !text-[22px]" : "!text-lg"}`}
      />
    </div>
  );
}
