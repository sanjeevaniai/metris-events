import "@tanstack/react-start/server-only";

import type { PassId } from "./passes";

/* The registration store, as an interface.

   Four logical tables, kept separate because they have different lifetimes and
   different owners:

     registrations   one row per PURCHASE. Holds the money, the pass, the
                     capacity allocation and its state machine.
     attendees       one row per NAMED PERSON. A Team Pass has up to five.
     stripe_events   processed Stripe event ids, so a replayed webhook is a
                     no-op instead of a second seat or a second email.
     entitlements    one row per ORGANIZATION. This is what makes "one eligible
                     assessment per verified organization" enforceable no
                     matter how many passes that organization buys.

   Nothing above this layer knows the storage is a Google Sheet. Swapping in a
   database means one more module satisfying RegistrationStore.

   EVERY METHOD MARKED ATOMIC MUST BE ATOMIC AT THE STORE, not in this process.
   Two Cloudflare isolates handling two buyers do not share memory, so a check
   here followed by a write here is not a reservation — it is a race. The sheet
   implementation gets its atomicity from Apps Script LockService. */

/* ----------------------------- state machines ---------------------------- */

/* Where a purchase is. The only transitions that exist:

     registration_started -> checkout_created -> paid
                                              -> checkout_expired
                                              -> payment_failed
     paid -> refunded

   paid is TERMINAL FOR CAPACITY. A later, duplicate, stale or out-of-order
   expiry event must never move a paid row back, or a seat somebody bought is
   resold underneath them. */
export type RegistrationState =
  | "registration_started"
  | "checkout_created"
  | "paid"
  | "checkout_expired"
  | "payment_failed"
  | "refunded";

/* What the allocation is doing to capacity.

     none      -> reserved  at checkout creation
     reserved  -> paid      on verified payment      (terminal)
     reserved  -> released  on expiry or failure
   
   released and paid are both terminal. Nothing returns to reserved. */
export type AllocationState = "none" | "reserved" | "paid" | "released";

/* Whether this buyer may be sold a place automatically. */
export type VerificationState = "verified" | "manual_review" | "refused";

/* ------------------------------- the rows -------------------------------- */

export type Registration = {
  eventId: string;
  registrationId: string;

  organizationKey: string;
  organizationName: string;
  organizationType: string;
  verifiedDomain: string;

  primaryPurchaserName: string;
  primaryBusinessEmail: string;
  primaryJobTitle: string;
  country: string;

  passId: PassId;
  /** places this purchase consumes. 1 for executive, 5 for team. */
  purchasedPlaces: number;

  registrationState: RegistrationState;
  allocationState: AllocationState;
  /** ISO. When a reservation stops being honoured if nothing confirms it. */
  reservationExpiresAt: string;

  verificationState: VerificationState;
  verificationReason: string;

  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string;
  amount: string;
  currency: string;

  termsAcceptedAt: string;
  /** null when consent was not given — not an empty string, which reads as given */
  marketingConsentAt: string | null;

  preliminaryUseCase: string;

  createdAt: string;
  updatedAt: string;
};

export type Attendee = {
  eventId: string;
  registrationId: string;
  organizationKey: string;
  attendeeId: string;

  attendeeName: string;
  attendeeEmail: string;

  verificationState: VerificationState;
  verificationReason: string;

  /* Zoom. Individual per attendee — see src/server/zoom.ts, which cannot yet
     produce these. "blocked" is an honest state, not a failure to record. */
  zoomRegistrationState: "pending" | "registered" | "failed" | "blocked";
  zoomRegistrantId: string;
  joinLinkDeliveryState: "pending" | "sent" | "failed" | "blocked";

  createdAt: string;
  updatedAt: string;
};

/* --------------------------------- results ------------------------------- */

export type StoreResult = { ok: true } | { ok: false; error: string };

/* The outcome of trying to take capacity. `granted: false` is a normal answer
   meaning sold out — it is not an error, and the caller must tell the buyer
   plainly rather than showing them a failure. */
export type ReservationResult =
  | { ok: true; granted: true; remaining: number }
  | { ok: true; granted: false; remaining: number; reason: string }
  | { ok: false; error: string };

export type UsedCapacity =
  { ok: true; reserved: number; paid: number } | { ok: false; error: string };

/* Idempotency claim. Exactly one caller is ever told alreadyDone: false, and
   only that caller may perform the side effect. A claim is a LEASE, not a
   receipt: if the effect then fails, the claim is released so a retry can try
   again. Claiming permanently on a failed send marks the row done and leaves
   the attendee with nothing. */
export type Claim = { ok: true; alreadyDone: boolean } | { ok: false; error: string };

export interface RegistrationStore {
  /* ---- registrations ---- */
  saveRegistration(row: Registration): Promise<StoreResult>;

  /* ATOMIC. Takes `places` from capacity for this checkout session, or refuses
     because not enough remain. Idempotent on stripeSessionId: re-reserving the
     same session returns the existing grant rather than taking more. */
  reserveSeats(input: {
    registrationId: string;
    stripeSessionId: string;
    places: number;
    expiresAt: string;
  }): Promise<ReservationResult>;

  /* ATOMIC. reserved -> paid. Refuses to act on a row that is not reserved or
     already paid, and re-running it on a paid row is a no-op that reports
     success, because Stripe will deliver the same event more than once. */
  markPaid(input: {
    registrationId: string;
    stripeSessionId: string;
    stripePaymentIntentId: string;
    amount: string;
    currency: string;
    paidAt: string;
  }): Promise<StoreResult>;

  /* ATOMIC. reserved -> released. MUST NOT touch a paid allocation: that is
     the out-of-order-event protection, and it lives at the store because only
     the store can check and change the state under one lock. */
  releaseReservation(input: {
    stripeSessionId: string;
    reason: "checkout_expired" | "payment_failed" | "checkout_creation_failed";
  }): Promise<StoreResult>;

  /* ATOMIC. Current consumption, for the availability endpoint and for the
     sold-out decision. Reserved and paid are reported separately because only
     reserved can ever go down. */
  usedCapacity(): Promise<UsedCapacity>;

  /* ---- attendees ---- */
  saveAttendees(rows: Attendee[]): Promise<StoreResult>;

  /* ---- webhook idempotency ---- */
  /* ATOMIC. Records that this Stripe event id has been seen. The FIRST caller
     gets alreadyDone: false and must do the work; every later delivery of the
     same event gets true and must do nothing. */
  claimStripeEvent(eventId: string, eventType: string): Promise<Claim>;
  releaseStripeEvent(eventId: string): Promise<StoreResult>;

  /* ---- confirmation email ---- */
  claimEmailSend(registrationId: string): Promise<Claim>;
  releaseEmailClaim(registrationId: string): Promise<StoreResult>;

  /* ---- assessment entitlement ---- */
  /* ATOMIC. One per verified organization, for all time and across every pass
     that organization ever buys. The first purchase creates it; every later
     one is told it already exists and must NOT create a second. */
  claimEntitlement(input: { organizationKey: string; registrationId: string }): Promise<Claim>;
}

/* ---------------------------------------------------------------------- */

import { sheetStore } from "./persistence-sheet";

let cached: RegistrationStore | undefined;

/** The one line to change when the sheet is replaced by a database. */
export function getStore(): RegistrationStore {
  if (!cached) cached = sheetStore();
  return cached;
}

/** The event these rows belong to. Every row carries it so a second event can
 *  share the sheet without the two capacity counts colliding. */
export function eventId(): string {
  return String(process.env["METRIS_EVENT_ID"] ?? "").trim() || "metris-exec-2026-10-14";
}
