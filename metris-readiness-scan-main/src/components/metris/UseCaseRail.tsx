import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Pause, Play, X } from "lucide-react";
import { eventConfig, USE_CASE_STATUS_LABEL, type UseCase } from "@/config/event";
import { track } from "@/lib/analytics";
import { scrollToSection } from "@/components/metris/nav-data";
import { setScenesFrozen } from "@/components/metris/Scene";
import { cn } from "@/lib/utils";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function UseCaseRail() {
  const reduced = usePrefersReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [active, setActive] = useState<UseCase | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const headingId = useId();

  const running = !reduced && !userPaused && !hovering && !active;

  const openCase = useCallback((uc: UseCase, trigger: HTMLElement | null) => {
    lastTrigger.current = trigger;
    setActive(uc);
    track("use_case_detail_opened", { use_case_id: uc.id });
  }, []);

  const close = useCallback(() => {
    setActive(null);
    lastTrigger.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Suspend the page's scroll-driven scene transitions behind the overlay.
    setScenesFrozen(true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      setScenesFrozen(false);
    };
  }, [active, close]);

  const cards = reduced
    ? eventConfig.useCases.map((uc, i) => ({ uc, key: `${uc.id}-${i}`, clone: false }))
    : [...eventConfig.useCases, ...eventConfig.useCases].map((uc, i) => ({
        uc,
        key: `${uc.id}-${i}`,
        clone: i >= eventConfig.useCases.length,
      }));

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovering(false);
      }}
    >
      <div className="mb-6 flex items-center justify-end gap-3 px-5 md:px-10">
        <span className="text-[0.8125rem] text-muted-foreground">
          {reduced ? "Scroll to browse use cases" : "Hover or focus a card to pause"}
        </span>
        {!reduced && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-pressed={userPaused}
            aria-label={userPaused ? "Play use case reel" : "Pause use case reel"}
            className="inline-flex size-11 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-lime-measure hover:text-foreground"
          >
            {userPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        )}
      </div>

      <div
        className={cn(
          "[overflow-x:clip] [overflow-y:visible] py-8",
          reduced && "no-scrollbar overflow-x-auto! snap-x snap-mandatory",
        )}
      >
        <ul
          aria-label="Healthcare AI use cases"
          className={cn(
            "flex w-max",
            reduced && "gap-5 px-5 md:px-10",
            !reduced && "animate-use-case-reel hover:[&>li:not(:hover)]:opacity-55",
          )}
          style={!reduced ? { animationPlayState: running ? "running" : "paused" } : undefined}
        >
          {cards.map(({ uc, key, clone }) => (
            <li
              key={key}
              aria-hidden={clone || undefined}
              className={cn(
                "w-[19rem] shrink-0 transition-opacity duration-300 sm:w-[22rem]",
                !reduced && "mr-5",
                reduced && "snap-start",
              )}
            >
              <button
                type="button"
                tabIndex={clone ? -1 : 0}
                onMouseEnter={() => track("use_case_card_viewed", { use_case_id: uc.id })}
                onClick={(e) => openCase(uc, e.currentTarget)}
                className="group relative block h-full w-full rounded-[24px] text-left transition-[transform,box-shadow] duration-500 ease-out hover:z-20 hover:-translate-y-2 hover:scale-[1.14] focus-visible:z-20 focus-visible:-translate-y-2 focus-visible:scale-[1.14]"
              >
                <article className="card-emboss flex h-full flex-col rounded-[24px] border border-hairline bg-card p-7 transition-[border-color,box-shadow] duration-500 group-hover:border-lime-measure group-hover:shadow-[0_1px_0_0_oklch(1_0_0_/_80%)_inset,0_2px_4px_0_oklch(0.243_0.028_272_/_10%),0_28px_60px_-24px_oklch(0.243_0.028_272_/_38%)] group-focus-visible:border-lime-measure group-focus-visible:shadow-[0_1px_0_0_oklch(1_0_0_/_80%)_inset,0_2px_4px_0_oklch(0.243_0.028_272_/_10%),0_28px_60px_-24px_oklch(0.243_0.028_272_/_38%)]">
                  {eventConfig.useCaseStatusConfirmed && (
                    <span
                      className={cn(
                        "mb-5 inline-flex w-fit rounded-full px-3 py-1 text-[0.6875rem] font-medium tracking-[0.14em] uppercase",
                        uc.status === "assessment_ready"
                          ? "bg-lime-measure text-ink"
                          : "border border-hairline text-muted-foreground",
                      )}
                    >
                      {USE_CASE_STATUS_LABEL[uc.status]}
                    </span>
                  )}
                  <h3 className="text-[1.375rem] leading-snug font-medium text-balance text-foreground">
                    {uc.title}
                  </h3>
                  {/* Marks the one worked example. Says nothing about the others,
                      deliberately — the status badges above stay hidden until
                      useCaseStatusConfirmed is true. */}
                  {uc.note && (
                    <p className="mt-3 text-[0.8125rem] leading-snug font-medium text-teal-deep">
                      {uc.note}
                    </p>
                  )}
                  <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
                    {uc.body}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-[0.9375rem] font-medium text-teal-deep opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    Explore this use case
                    <ArrowRight className="size-4" />
                  </span>
                </article>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="animate-scale-in min-h-full bg-background">
            <div className="mx-auto max-w-[62rem] px-5 py-10 md:px-10 md:py-16">
              <button
                type="button"
                autoFocus
                onClick={close}
                className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-[0.9375rem] text-foreground transition-colors hover:border-lime-measure"
              >
                <X className="size-4" />
                Back to use cases
              </button>

              <p className="mt-12 text-[0.6875rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Use case
              </p>
              <h2
                id={headingId}
                className="mt-5 text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.05] font-light tracking-[-0.02em] text-foreground"
              >
                {active.title}
              </h2>
              <p className="mt-6 max-w-[46rem] text-[1.125rem] leading-relaxed text-muted-foreground">
                {active.body}
              </p>

              <dl className="mt-14 grid gap-px overflow-hidden rounded-[24px] border border-hairline bg-hairline md:grid-cols-2">
                <DetailBlock label="The decision or workflow involved">
                  {active.detail.decision}
                </DetailBlock>
                <DetailBlock label="Why organizational readiness can break">
                  {active.detail.breakage}
                </DetailBlock>
                <DetailBlock label="What METRIS measures for your systems and your workforce">
                  {active.detail.measures}
                </DetailBlock>
                <DetailBlock label="Relevant teams or role groups">
                  {active.detail.roles.join(" · ")}
                </DetailBlock>
                <DetailBlock label="Assessment availability">
                  {active.detail.availability}
                </DetailBlock>
                <DetailBlock label="Scope and eligibility boundary">
                  {active.detail.boundary}
                </DetailBlock>
              </dl>

              <div className="mt-12 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    track("cta_register_click", { location: "use_case_detail" });
                    close();
                    setTimeout(() => scrollToSection("register"), 60);
                  }}
                  className="inline-flex items-center rounded-full bg-primary px-7 py-4 text-[1rem] font-medium text-primary-foreground transition-colors hover:bg-lime-measure hover:text-ink"
                >
                  {eventConfig.ctaLabel}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="text-[0.9375rem] text-muted-foreground underline-offset-4 hover:underline"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card p-7">
      <dt className="text-[0.6875rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-3 text-[1.0625rem] leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}
