import type { Config } from "tailwindcss";

// Arch Public tokens, the same as Strategy Lab Pro (src/index.css in the Pro app).
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/core/src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Mulish", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        muted: { DEFAULT: "hsl(var(--muted) / <alpha-value>)", foreground: "hsl(var(--muted-foreground) / <alpha-value>)" },
        primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", foreground: "hsl(var(--primary-foreground) / <alpha-value>)" },
        navy: "hsl(var(--navy) / <alpha-value>)",
        chip: "hsl(var(--chip) / <alpha-value>)",
        gain: "hsl(var(--gain) / <alpha-value>)",
        loss: "hsl(var(--loss) / <alpha-value>)",
        warn: "hsl(var(--warn) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      borderRadius: { lg: "16px", md: "10px", sm: "6px" },
      boxShadow: {
        sm: "0 1px 2px hsl(231 77% 19% / 0.06)",
        md: "0 4px 12px hsl(231 77% 19% / 0.1), 0 1px 3px hsl(231 77% 19% / 0.06)",
        lg: "0 16px 40px hsl(231 77% 19% / 0.16), 0 4px 12px hsl(231 77% 19% / 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
