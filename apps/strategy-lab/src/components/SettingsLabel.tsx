"use client";
// Where Pro shows settings, the public page says where they are (PRD 9,
// "Settings"; redesign PRD section 5, block 8). A navy band with a lock, the
// settings label and Start free. No link to Pro until the login move.
import { track } from "@/lib/analytics";
import { StartFreeLink, useBooking } from "./Booking";

export function SettingsLabel({ slug, id }: { slug: string; id: string }) {
  const { settings } = useBooking();
  return (
    <section
      aria-label="Settings"
      data-theme="navy"
      className="flex flex-wrap items-center gap-5 rounded-lg bg-navy px-6 py-7 sm:px-8"
      onClickCapture={() => track("settings_label_clicked", { strategy_id: id, strategy: slug })}
    >
      <svg aria-hidden="true" className="h-8 w-8 shrink-0 text-on-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p className="min-w-0 flex-[1_1_320px] text-[17px] font-bold leading-normal text-white">{settings.booking.settingsLabel}</p>
      <StartFreeLink source="strategy-pro-prompt" strategy={slug} variant="white" className="!min-h-[48px] !px-[22px] !text-[15px]" />
    </section>
  );
}
