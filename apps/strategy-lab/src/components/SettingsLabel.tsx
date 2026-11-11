"use client";
// Where Pro shows settings, the public page says where they are (PRD 9,
// "Settings"). Its action is Start free. No link to Pro until the login move.
import { track } from "@/lib/analytics";
import { StartFreeLink, useBooking } from "./Booking";

export function SettingsLabel({ slug, id }: { slug: string; id: string }) {
  const { settings } = useBooking();
  return (
    <section aria-labelledby="settings-h" className="rounded-lg border border-dashed border-border-strong bg-muted p-5" onClickCapture={() => track("settings_label_clicked", { strategy_id: id, strategy: slug })}>
      <h2 id="settings-h" className="text-lg">Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">{settings.booking.settingsLabel}</p>
      <div className="mt-3">
        <StartFreeLink source="settings-label" strategy={slug} variant="primary" />
      </div>
    </section>
  );
}
