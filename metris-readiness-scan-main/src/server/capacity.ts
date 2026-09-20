import "@tanstack/react-start/server-only";

import { eventConfig } from "../config/event";
import { pass, type PassId } from "./passes";

/* Capacity, in NAMED ATTENDEE PLACES.

   Zoom can hold zoomPlatformCapacity people. Only publicSaleableCapacity of
   those may be sold through self-service; the difference is operatingBuffer,
   which exists so host, panelist, support and manually-approved places always
   fit. The buffer is never sold, and no code path here can reach into it.

   A place is consumed by a RESERVATION as well as by a payment. That is the
   whole point: without counting reservations, everyone in a checkout queue
   sees the same "one place left" and they all pay for it.

   These functions are pure. The counts come from the store, which is the only
   thing that can produce them atomically — see reserveSeats in
   src/server/persistence.ts. */

export type Used = {
  /** places held by checkout sessions that have neither completed nor expired */
  reserved: number;
  /** places belonging to a verified payment. Terminal. */
  paid: number;
};

export type Availability = {
  saleable: number;
  used: number;
  remaining: number;
  /** the reserved-but-unpaid part, for operational visibility only */
  reserved: number;
  paid: number;
  executiveAvailable: boolean;
  teamAvailable: boolean;
  soldOut: boolean;
};

export function availability(used: Used): Availability {
  const saleable = eventConfig.publicSaleableCapacity;
  /* a negative count would silently create capacity, so it is clamped */
  const reserved = Math.max(0, used.reserved);
  const paid = Math.max(0, used.paid);
  const consumed = reserved + paid;
  const remaining = Math.max(0, saleable - consumed);

  const executiveAvailable = remaining >= pass("executive").places;
  const teamAvailable = remaining >= pass("team").places;

  return {
    saleable,
    used: consumed,
    remaining,
    reserved,
    paid,
    executiveAvailable,
    teamAvailable,
    /* Sold out means NEITHER pass fits. With four places left the page is not
       sold out — it is Executive-only. */
    soldOut: !executiveAvailable && !teamAvailable,
  };
}

export function fits(id: PassId, used: Used): boolean {
  return availability(used).remaining >= pass(id).places;
}

/* Whether self-service registration is open at all, before capacity is even
   consulted. The administrative switch closes the door early and independently;
   capacity closes it when the room is full. Both are checked server-side. */
export function registrationOpen(): boolean {
  return eventConfig.registrationOpen && eventConfig.registrationStatus === "open";
}

/* The buffer, stated as a function rather than read from config at the call
   site, so that no caller can accidentally sell into it. */
export function operatingBuffer(): number {
  return eventConfig.zoomPlatformCapacity - eventConfig.publicSaleableCapacity;
}
