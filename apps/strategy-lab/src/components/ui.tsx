"use client";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-border-strong bg-card px-5 py-2.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
  onDark:
    "inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
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
  "w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

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

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
      <span>{children}</span>
    </label>
  );
}

/** Dollar amount typed by the visitor; reports positive numbers only. */
export function MoneyInput({ value, onChange, id, label }: { value: number | null; onChange: (n: number | null) => void; id?: string; label: string }) {
  const text = value && value > 0 ? Math.round(value).toLocaleString("en-US") : "";
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
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
        className={`${control} pl-7 font-mono tabular-nums`}
      />
    </div>
  );
}
