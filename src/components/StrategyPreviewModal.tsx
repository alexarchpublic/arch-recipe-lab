// The admin console's Pro preview of a version (A7): the same component the
// strategy page renders, at the version's own starting capital.
import type { ProStrategy } from "@core";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StrategyDetail } from "@/components/pro/StrategyDetail";

export function StrategyPreviewModal({
  strategy,
  open,
  onOpenChange,
}: {
  strategy: ProStrategy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!strategy) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-background p-6 sm:p-8">
        <DialogTitle className="sr-only">Strategy Lab Pro preview: {strategy.title}</DialogTitle>
        <p className="eyebrow -mt-1 mb-2">Strategy Lab Pro preview</p>
        <StrategyDetail strategy={strategy} capital={strategy.starting_capital} />
      </DialogContent>
    </Dialog>
  );
}
