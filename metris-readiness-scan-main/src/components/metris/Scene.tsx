import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-driven "editorial scene" transition.
 *
 * Every major section is treated as a scene whose opacity / translateY / scale
 * are derived from actual scroll position (not a one-shot entrance), so the
 * effect reverses naturally when scrolling back up.
 *
 * Disabled entirely under `prefers-reduced-motion`; softened on small screens.
 * While a use-case detail overlay is open the transitions are suspended.
 */

let frozen = false;
const listeners = new Set<() => void>();

/** Suspend/resume all scene transitions (used by the use-case detail view). */
export function setScenesFrozen(value: boolean) {
  frozen = value;
  for (const fn of listeners) fn();
}

interface SceneProps {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Skip the incoming animation (used by the hero, which is on screen first). */
  noEnter?: boolean;
  /** Gentler treatment for long / interactive sections such as registration. */
  calm?: boolean;
  [key: string]: unknown;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function Scene({ children, className, noEnter = false, calm = false, ...rest }: SceneProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setEnabled(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) {
      if (node) node.removeAttribute("style");
      return;
    }

    let raf = 0;
    const apply = () => {
      raf = 0;
      if (frozen) return;
      const vh = window.innerHeight || 1;
      const mobile = window.innerWidth < 768;
      const rect = node.getBoundingClientRect();

      const enterSpan = vh * (calm ? 0.5 : 0.34);
      const exitSpan = vh * (calm ? 0.5 : 0.38);

      const enter = noEnter ? 1 : clamp((vh - rect.top) / enterSpan);
      const exit = clamp((exitSpan - rect.bottom) / exitSpan);

      // Scale the effect down on mobile to avoid visual instability.
      const k = (mobile ? 0.5 : 1) * (calm ? 0.6 : 1);
      const opacity = enter * (1 - exit);
      const ty = (1 - enter) * 40 * k - exit * 24 * k;
      const scale = 1 - 0.015 * k * (1 - enter + exit);
      const blur = exit * 2 * (mobile ? 0.5 : 1);

      node.style.opacity = String(opacity.toFixed(3));
      node.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      node.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
      node.style.pointerEvents = opacity < 0.15 ? "none" : "";
      node.style.willChange = "opacity, transform";
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onFreezeChange = () => {
      if (frozen) {
        node.style.filter = "";
        node.style.opacity = "1";
        node.style.transform = "none";
        node.style.pointerEvents = "";
      } else {
        onScroll();
      }
    };
    listeners.add(onFreezeChange);

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      listeners.delete(onFreezeChange);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      node.removeAttribute("style");
    };
  }, [enabled, noEnter, calm]);

  return (
    <section ref={ref as never} className={cn(className)} {...rest}>
      {children}
    </section>
  );
}
