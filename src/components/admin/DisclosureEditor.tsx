// Disclaimer wording (PRD C2): approvers and marketing editors set it here and
// it goes live in both front ends without a deploy.
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { DEFAULT_DISCLAIMER, DISCLOSURE_KEYS, DisclaimerSlot, type DisclosureKey } from "@core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { setDisclosure, useDisclosures, useInvalidateDisclosures } from "@/data/disclosures";
import type { AdminRole } from "@/data/adminVersions";

export function DisclosureEditor({ role }: { role: AdminRole | null }) {
  const canEdit = role === "approver" || role === "marketing_editor";
  const { data, error } = useDisclosures();
  const invalidate = useInvalidateDisclosures();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [key] = useState<DisclosureKey>("results");
  const current = data?.find((d) => d.key === key);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(current?.body ?? DEFAULT_DISCLAIMER);
  }, [open, current]);

  const meta = DISCLOSURE_KEYS.find((k) => k.key === key)!;

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" /> Disclaimer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{meta.label}</DialogTitle>
            <DialogDescription>
              {meta.help} Changes go live on the next page load, with no deploy.
              {!canEdit && " Only approvers and marketing editors can change it."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              The disclaimer table is not in this database yet (migration 20261112000001). The default wording is showing.
            </p>
          )}
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} maxLength={2000} disabled={!canEdit || !!error} aria-label="Disclaimer wording" />
          <div className="rounded-md border border-border bg-muted p-3">
            <p className="eyebrow mb-1">Preview</p>
            <DisclaimerSlot text={draft} />
          </div>
          {current?.updated_at && (
            <p className="text-xs text-muted-foreground">Last changed {new Date(current.updated_at).toLocaleString()}.</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              disabled={!canEdit || !!error || saving || !draft.trim() || draft.trim() === current?.body}
              onClick={async () => {
                setSaving(true);
                try {
                  await setDisclosure(key, draft);
                  await invalidate();
                  toast({ title: "Disclaimer updated", description: "It shows on both front ends from the next page load." });
                  setOpen(false);
                } catch (e) {
                  toast({ variant: "destructive", title: "Could not save", description: e instanceof Error ? e.message : String(e) });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Publish wording"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
