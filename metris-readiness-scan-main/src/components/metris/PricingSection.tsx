import { Check } from "lucide-react";
import { eventConfig } from "@/config/event";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/metris/Reveal";
import { scrollToSection } from "@/components/metris/nav-data";
import { useAvailability } from "@/components/metris/useAvailability";

/* The two passes.

   Availability comes from verified server state. When fewer than five places
   remain the Team Pass is shown as unavailable rather than hidden, because a
   pass that silently vanishes reads as a bug — and an organization that came
   for the team option deserves to be told why it is gone. */

export function PricingSection({ onChoose }: { onChoose: (passId: "executive" | "team") => void }) {
  const a = useAvailability();
  const passes = [eventConfig.passes.executive, eventConfig.passes.team] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {passes.map((p, i) => {
        const isTeam = p.id === "team";
        const available = a.loading ? true : isTeam ? a.teamAvailable : a.executiveAvailable;

        return (
          <Reveal
            key={p.id}
            delay={i * 90}
            className={cn(
              "card-emboss flex flex-col rounded-[26px] border border-hairline bg-card p-8 md:p-10",
              !available && "opacity-70",
            )}
          >
            <h3 className="text-[1.5rem] font-medium text-foreground">{p.name}</h3>
            <p className="mt-2 text-[0.9375rem] text-muted-foreground">{p.tagline}</p>

            <p className="mt-7 text-[2.5rem] leading-none font-light tracking-[-0.02em] text-foreground">
              {p.priceLabel}
              <span className="ml-2 align-middle text-[0.9375rem] font-normal text-muted-foreground">
                {p.currency}
              </span>
            </p>

            <ul className="mt-8 flex-1 space-y-3 text-[1rem] text-muted-foreground">
              {p.includes.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-teal-deep" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {available ? (
              <button
                type="button"
                onClick={() => {
                  track("cta_choose_pass", { pass: p.id });
                  onChoose(p.id);
                  scrollToSection("register");
                }}
                className="mt-9 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-[1rem] font-medium text-primary-foreground transition-colors hover:bg-lime-measure hover:text-ink focus-visible:bg-lime-measure focus-visible:text-ink"
              >
                {p.cta}
              </button>
            ) : (
              <div
                role="status"
                className="mt-9 rounded-[16px] border border-hairline bg-paper p-4 text-[0.9375rem] text-muted-foreground"
              >
                <p className="font-medium text-foreground">
                  {a.soldOut ? "Sold out" : "Not available"}
                </p>
                <p className="mt-1">
                  {a.soldOut
                    ? "This session is fully booked."
                    : `Fewer than ${eventConfig.passes.team.places} places remain, so this pass can no longer be reserved. The ${eventConfig.passes.executive.name} is still available.`}
                </p>
              </div>
            )}
          </Reveal>
        );
      })}

      <p className="lg:col-span-2 text-[0.9375rem] text-muted-foreground">
        {eventConfig.moreThanFiveLine}
      </p>
    </div>
  );
}
