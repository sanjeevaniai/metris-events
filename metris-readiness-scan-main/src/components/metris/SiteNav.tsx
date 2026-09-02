import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { eventConfig } from "@/config/event";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ALL_SECTION_IDS, NAV_ITEMS, scrollToSection } from "./nav-data";
import { BrandLogo } from "./BrandLogo";

export function SiteNav() {
  const [active, setActive] = useState<string>("home");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    for (const id of ALL_SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const light = !scrolled && !open; // over the dark hero

  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  const register = (location: string) => {
    track("cta_register_click", { location });
    go("register");
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "bg-background/92 border-b border-hairline backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 sm:h-20 md:px-10"
      >
        <button
          type="button"
          onClick={() => go("home")}
          className="flex items-center gap-2.5 text-left"
        >
          <BrandLogo wordmarkClassName={light ? "text-warm-white" : "text-foreground"} />
          <span className="sr-only">— back to top</span>
        </button>

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative py-2 text-[0.9375rem] transition-colors",
                    light
                      ? isActive
                        ? "text-warm-white"
                        : "text-warm-white/60 hover:text-warm-white"
                      : isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime-measure transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => register("nav")}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 text-[0.875rem] font-medium transition-colors hover:bg-lime-measure hover:text-ink focus-visible:bg-lime-measure focus-visible:text-ink sm:px-5 sm:text-[0.9375rem]",
              light ? "bg-warm-white text-ink" : "bg-primary text-primary-foreground",
            )}
          >
            {eventConfig.ctaLabel}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border lg:hidden",
              light ? "border-warm-white/30 text-warm-white" : "border-hairline text-foreground",
            )}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-hairline bg-background lg:hidden"
      >
        <ul className="mx-auto max-w-[1440px] px-5 py-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => go(item.id)}
                className="w-full py-3 text-left text-lg text-foreground"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
