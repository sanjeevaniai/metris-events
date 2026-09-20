import { useEffect, useState } from "react";

/* Verified server capacity, for DISPLAY ONLY.

   This decides which CTAs render. It cannot authorize a checkout and must
   never be treated as though it can: /api/checkout re-checks capacity
   atomically at the moment of purchase, regardless of what this said. A stale
   answer here costs a buyer one clear "the last places went" message; a stale
   answer trusted as authority would oversell the room.

   No exact remaining count is exposed — see src/routes/api/availability.ts. */

export type Availability = {
  loading: boolean;
  open: boolean;
  executiveAvailable: boolean;
  teamAvailable: boolean;
  soldOut: boolean;
  teamPassUnavailableReason: "sold_out" | "fewer_than_five_remaining" | null;
  /** true when capacity could not be established at all */
  unknown: boolean;
};

const INITIAL: Availability = {
  loading: true,
  open: true,
  /* Optimistic while loading so the page does not flash "sold out" at
     everybody on every visit. Nothing can be bought from this state. */
  executiveAvailable: true,
  teamAvailable: true,
  soldOut: false,
  teamPassUnavailableReason: null,
  unknown: false,
};

export function useAvailability(): Availability {
  const [state, setState] = useState<Availability>(INITIAL);

  useEffect(() => {
    let live = true;
    fetch("/api/availability")
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (!live) return;
        if (d["ok"] !== true) {
          setState({ ...INITIAL, loading: false, unknown: true });
          return;
        }
        setState({
          loading: false,
          unknown: false,
          open: d["open"] === true,
          executiveAvailable: d["executiveAvailable"] === true,
          teamAvailable: d["teamAvailable"] === true,
          soldOut: d["soldOut"] === true,
          teamPassUnavailableReason:
            (d["teamPassUnavailableReason"] as Availability["teamPassUnavailableReason"]) ?? null,
        });
      })
      .catch(() => {
        if (live) setState({ ...INITIAL, loading: false, unknown: true });
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
