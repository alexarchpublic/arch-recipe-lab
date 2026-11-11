// Strategy Lab content (PRD S12, A10, C5): copy, section order, featured
// strategies, partner pages and switches. Approvers and marketing editors
// change them here; Strategy Lab shows the change without a deploy. Figures
// cannot be stored here: they always come from the published strategy.
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { ALL_SECTIONS, DEFAULT_CONTENT, type SectionId } from "@core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { AdminRole, StrategyGroup } from "@/data/adminVersions";
import { setSiteContent, useInvalidateSiteContent, useSiteContent } from "@/data/siteContent";
import { STRATEGY_LAB_URL, refreshStrategyLab } from "@/data/strategyLab";

type Obj = Record<string, unknown>;

const SECTION_LABEL: Record<SectionId, string> = {
  finder: "Strategy finder",
  library: "Library at a glance",
  top: "Top strategies",
  how: "How it works",
  proof: "Clients and case studies",
  clients: "What clients get (Pro)",
  book: "Book a demo",
};

/** Public figures marketing may hide from Strategy Lab (C5). */
const HIDEABLE: Array<[string, string]> = [
  ["cagr_pct", "CAGR"],
  ["net_profit_usd", "Net profit"],
  ["ending_value_usd", "Ending value"],
  ["cash_profit_usd", "Cash profit"],
  ["asset_qty", "Asset accumulated"],
  ["vs_buy_hold_pct", "vs buy and hold"],
  ["vs_dca_pct", "vs buying monthly"],
  ["buy_hold_pnl_pct", "Buy and hold return"],
  ["dca_pnl_pct", "Buying monthly return"],
  ["max_drawdown_pct", "Max drawdown"],
];

const get = (o: Obj, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Obj)[k] : undefined), o);

/** Sets a nested field; an empty string or empty list removes it, so the default shows. */
function set(o: Obj, path: string, value: unknown): Obj {
  const keys = path.split(".");
  const out: Obj = { ...o };
  let cur = out;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = { ...((cur[k] as Obj) ?? {}) };
    cur = cur[k] as Obj;
  });
  const last = keys[keys.length - 1];
  if (value === "" || value === undefined || (Array.isArray(value) && value.length === 0)) delete cur[last];
  else cur[last] = value;
  return out;
}

function Text({ label, obj, path, onChange, placeholder, area }: { label: string; obj: Obj; path: string; onChange: (o: Obj) => void; placeholder?: string; area?: boolean }) {
  const value = (get(obj, path) as string | undefined) ?? "";
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {area ? (
        <Textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(set(obj, path, e.target.value))} />
      ) : (
        <Input value={value} placeholder={placeholder} onChange={(e) => onChange(set(obj, path, e.target.value))} />
      )}
    </div>
  );
}

function SlugList({ value, options, onChange, max = 9 }: { value: string[]; options: Array<{ slug: string; label: string }>; onChange: (v: string[]) => void; max?: number }) {
  const label = (slug: string) => options.find((o) => o.slug === slug)?.label ?? `${slug} (not published)`;
  return (
    <div className="space-y-2">
      {value.map((slug, i) => (
        <div key={slug} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
          <span className="flex-1 truncate">{label(slug)}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => onChange(value.map((v, j) => (j === i - 1 ? slug : j === i ? value[i - 1] : v)))} aria-label="Move up">
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(value.filter((v) => v !== slug))} aria-label="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {value.length < max && (
        <select
          className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        >
          <option value="">Add a strategy…</option>
          {options.filter((o) => !value.includes(o.slug)).map((o) => (
            <option key={o.slug} value={o.slug}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export function SiteContentEditor({ role, groups }: { role: AdminRole | null; groups: StrategyGroup[] }) {
  const canEdit = role === "approver" || role === "marketing_editor";
  const [open, setOpen] = useState(false);
  const { data, error, isLoading } = useSiteContent(open);
  const invalidate = useInvalidateSiteContent();
  const { toast } = useToast();
  const [home, setHome] = useState<Obj>({});
  const [booking, setBooking] = useState<Obj>({});
  const [config, setConfig] = useState<Obj>({});
  const [partnerKey, setPartnerKey] = useState("");
  const [partner, setPartner] = useState<Obj>({});
  const [newSlug, setNewSlug] = useState("");
  const [rawKey, setRawKey] = useState("home");
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);

  const row = (key: string) => (data?.find((r) => r.key === key)?.value ?? {}) as Obj;
  useEffect(() => {
    if (!open || !data) return;
    setHome(row("home"));
    setBooking(row("booking"));
    setConfig(row("config"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);
  useEffect(() => {
    setRaw(JSON.stringify(row(rawKey), null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawKey, data]);

  const options = useMemo(
    () =>
      groups
        .filter((g) => g.published && !g.archivedAt && g.published.listed_public)
        .map((g) => ({ slug: g.published!.slug, label: `#${g.displayNumber} ${g.published!.short_name} (${g.published!.asset})` }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [groups],
  );
  const partners = (data ?? []).filter((r) => r.key.startsWith("partner:"));
  const sections = ((get(home, "sections") as SectionId[] | undefined) ?? ALL_SECTIONS).filter((s) => ALL_SECTIONS.includes(s));
  const hidden = (get(config, "hiddenFields") as string[] | undefined) ?? [];

  const save = async (key: string, value: Obj | null, done?: string) => {
    setSaving(true);
    try {
      await setSiteContent(key, value);
      await invalidate();
      const lab = await refreshStrategyLab("content");
      toast({
        title: done ?? "Saved",
        description: lab.ok ? "Strategy Lab is showing it now." : STRATEGY_LAB_URL ? `Saved. Strategy Lab did not refresh (${lab.detail}); it will within two minutes.` : "Saved. Strategy Lab shows it within two minutes.",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const disabled = !canEdit || !!error || saving;

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <LayoutTemplate className="h-4 w-4" /> Strategy Lab content
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Strategy Lab content</DialogTitle>
            <DialogDescription>
              Copy, layout, featured strategies, partner pages and switches for the public site. Empty fields use the default
              wording. Figures always come from the published strategy and cannot be typed here.
              {!canEdit && " Only approvers and marketing editors can change this."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              The content table is not in this database yet (migration 20261113000001). Strategy Lab is showing its default copy.
            </p>
          )}
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <Tabs defaultValue="home">
            <TabsList className="flex-wrap">
              <TabsTrigger value="home">Home page</TabsTrigger>
              <TabsTrigger value="booking">Booking and labels</TabsTrigger>
              <TabsTrigger value="switches">Switches</TabsTrigger>
              <TabsTrigger value="partners">Partner pages</TabsTrigger>
              <TabsTrigger value="json">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="space-y-4 pt-2">
              <Text label="Headline" obj={home} path="hero.headline" onChange={setHome} placeholder={DEFAULT_CONTENT.home.hero.headline} area />
              <Text label="Subhead" obj={home} path="hero.subhead" onChange={setHome} placeholder={DEFAULT_CONTENT.home.hero.subhead} area />
              <div className="space-y-1">
                <Label className="text-xs">Strategy in the hero</Label>
                <select className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm" value={(get(home, "hero.featured") as string) ?? ""} onChange={(e) => setHome(set(home, "hero.featured", e.target.value))}>
                  <option value="">The highest return</option>
                  {options.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
                </select>
              </div>
              <Text label="Who runs the demo (shown beside the actions)" obj={home} path="trust.demoBy" onChange={setHome} placeholder="e.g. Demos are run by Jane Doe, head of client success" />
              <div className="space-y-1">
                <Label className="text-xs">Top strategies, in order (empty: ranked by return)</Label>
                <SlugList value={(get(home, "featured") as string[] | undefined) ?? []} options={options} onChange={(v) => setHome(set(home, "featured", v))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sections, in order</Label>
                <div className="space-y-1">
                  {ALL_SECTIONS.map((id) => {
                    const on = sections.includes(id);
                    const i = sections.indexOf(id);
                    return (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <Switch checked={on} onCheckedChange={(v) => setHome(set(home, "sections", v ? [...sections, id] : sections.filter((s) => s !== id)))} />
                        <span className="flex-1">{SECTION_LABEL[id]}{on ? ` · ${i + 1}` : ""}</span>
                        {on && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => setHome(set(home, "sections", sections.map((s, j) => (j === i - 1 ? id : j === i ? sections[i - 1] : s))))} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === sections.length - 1} onClick={() => setHome(set(home, "sections", sections.map((s, j) => (j === i + 1 ? id : j === i ? sections[i + 1] : s))))} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <Text label="Walkthrough video link (empty: hidden)" obj={home} path="how.videoUrl" onChange={setHome} />
              <Text label="Page title (search and share)" obj={home} path="seo.title" onChange={setHome} placeholder={DEFAULT_CONTENT.home.seo.title} />
              <Text label="Page description" obj={home} path="seo.description" onChange={setHome} placeholder={DEFAULT_CONTENT.home.seo.description} area />
              <p className="text-xs text-muted-foreground">Case studies, testimonials and the remaining copy are under Advanced.</p>
              <DialogFooter>
                <Button disabled={disabled} onClick={() => save("home", home, "Home page saved")}>Publish home page</Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="booking" className="space-y-4 pt-2">
              <Text label="Demo booking link (HubSpot meeting)" obj={booking} path="meetingUrl" onChange={setBooking} placeholder={DEFAULT_CONTENT.booking.meetingUrl} />
              <Text label="Sales response time, shown after booking (empty: hidden)" obj={booking} path="responseTime" onChange={setBooking} placeholder="e.g. We reply within one business day." />
              <Text label="After booking" obj={booking} path="confirmationNote" onChange={setBooking} placeholder={DEFAULT_CONTENT.booking.confirmationNote} area />
              <Text label="Settings label on strategy pages" obj={booking} path="settingsLabel" onChange={setBooking} placeholder={DEFAULT_CONTENT.booking.settingsLabel} area />
              <Text label="Marketing email consent line" obj={booking} path="consentMarketing" onChange={setBooking} placeholder={DEFAULT_CONTENT.booking.consentMarketing} area />
              <Text label="Calls and texts consent line" obj={booking} path="consentCalls" onChange={setBooking} placeholder={DEFAULT_CONTENT.booking.consentCalls} area />
              <Text label="Notice at collection" obj={booking} path="collectionNotice" onChange={setBooking} placeholder={DEFAULT_CONTENT.booking.collectionNotice} area />
              <DialogFooter>
                <Button disabled={disabled} onClick={() => save("booking", booking, "Booking and labels saved")}>Publish booking and labels</Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="switches" className="space-y-4 pt-2">
              {([
                ["finder", "Strategy finder"],
                ["accountSize", "Account-size view"],
                ["emailMeThis", "Email me these figures"],
                ["alerts", "New-strategy alerts"],
              ] as const).map(([k, label]) => (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <Switch checked={(get(config, k) as boolean | undefined) ?? DEFAULT_CONTENT.config[k]} onCheckedChange={(v) => setConfig(set(config, k, v))} />
                  <span>{label}</span>
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Figures hidden on Strategy Lab</Label>
                <div className="grid grid-cols-2 gap-1">
                  {HIDEABLE.map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={hidden.includes(field)} onChange={(e) => setConfig(set(config, "hiddenFields", e.target.checked ? [...hidden, field] : hidden.filter((h) => h !== field)))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button disabled={disabled} onClick={() => save("config", config, "Switches saved")}>Publish switches</Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="partners" className="space-y-4 pt-2">
              <div className="flex flex-wrap gap-2">
                {partners.map((p) => (
                  <Button key={p.key} size="sm" variant={partnerKey === p.key ? "default" : "outline"} onClick={() => { setPartnerKey(p.key); setPartner(p.value as Obj); }}>
                    {(p.value.name as string) || p.key.slice(8)}
                  </Button>
                ))}
                <div className="flex items-center gap-1">
                  <Input className="h-9 w-40" placeholder="new-partner-slug" value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
                  <Button size="sm" variant="outline" disabled={!newSlug} onClick={() => { setPartnerKey(`partner:${newSlug}`); setPartner({ name: "" }); setNewSlug(""); }}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
              {partnerKey && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Address: {STRATEGY_LAB_URL || "/strategy-lab"}/p/{partnerKey.slice(8)}. Every capture from this page carries the partner ID.
                  </p>
                  <Text label="Partner name" obj={partner} path="name" onChange={setPartner} />
                  <Text label="Partner ID sent to HubSpot (empty: the slug)" obj={partner} path="partner_id" onChange={setPartner} />
                  <Text label="Headline" obj={partner} path="headline" onChange={setPartner} area />
                  <Text label="Subhead" obj={partner} path="subhead" onChange={setPartner} area />
                  <Text label="Partner logo link" obj={partner} path="logo_url" onChange={setPartner} />
                  <div className="space-y-1">
                    <Label className="text-xs">Featured strategies (the first is in the hero)</Label>
                    <SlugList value={(get(partner, "featured") as string[] | undefined) ?? []} options={options} onChange={(v) => setPartner(set(partner, "featured", v))} />
                  </div>
                  <DialogFooter className="gap-2">
                    {partners.some((p) => p.key === partnerKey) && (
                      <Button variant="ghost" disabled={disabled} onClick={async () => { await save(partnerKey, null, "Partner page removed"); setPartnerKey(""); }}>
                        Remove page
                      </Button>
                    )}
                    <Button disabled={disabled || !(get(partner, "name") as string)} onClick={() => save(partnerKey, partner, "Partner page saved")}>Publish partner page</Button>
                  </DialogFooter>
                </div>
              )}
            </TabsContent>

            <TabsContent value="json" className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Every key as stored. Fields left out use the defaults. Proof items take title, quote, name, role, href and strategies (slugs).
              </p>
              <select className="rounded-md border border-input bg-background px-2 py-2 text-sm" value={rawKey} onChange={(e) => setRawKey(e.target.value)}>
                {["home", "booking", "config", ...partners.map((p) => p.key)].map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <Textarea rows={14} className="font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} />
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Defaults for reference</summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted p-2">{JSON.stringify(rawKey === "home" ? DEFAULT_CONTENT.home : rawKey === "booking" ? DEFAULT_CONTENT.booking : rawKey === "config" ? DEFAULT_CONTENT.config : {}, null, 2)}</pre>
              </details>
              <DialogFooter>
                <Button
                  disabled={disabled}
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(raw || "{}");
                      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("It must be a JSON object.");
                      void save(rawKey, parsed, `${rawKey} saved`);
                    } catch (e) {
                      toast({ variant: "destructive", title: "Not valid JSON", description: e instanceof Error ? e.message : String(e) });
                    }
                  }}
                >
                  Publish {rawKey}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
