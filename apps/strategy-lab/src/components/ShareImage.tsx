// The share card for a strategy page or the home page (S6). Rendered by next/og.
export function ShareCard({ eyebrow, title, line, figure, figureLabel, basis }: { eyebrow: string; title: string; line: string; figure?: string; figureLabel?: string; basis?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0B1656", color: "white", padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 26, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>{eyebrow}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: title.length > 60 ? 54 : 64, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "rgba(255,255,255,0.8)" }}>{line}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        {figure ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#3DD598" }}>{figure}</div>
            <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.7)" }}>{figureLabel}</div>
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          {basis && <div style={{ display: "flex", fontSize: 22, padding: "6px 14px", border: "2px solid #F5A524", color: "#F5A524", borderRadius: 999 }}>{basis}</div>}
          <div style={{ display: "flex", marginTop: 14, fontSize: 30, fontWeight: 800 }}>Arch Public · Strategy Lab</div>
        </div>
      </div>
    </div>
  );
}
