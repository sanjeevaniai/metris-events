import "@tanstack/react-start/server-only";

import { eventConfig } from "../config/event";

/* Which pass was bought, resolved on the server.

   The browser posts a pass ID — "executive" or "team" — and NOTHING else about
   money or capacity. Price, currency, Stripe price id and the number of places
   consumed are all looked up here from configuration and the environment. A
   tampered client can therefore change which of two fixed products it asks
   for, and nothing else: it cannot invent a price, a discount, a currency, or
   a seat count.

   As with the single price before it, nothing in this repo CREATES a Stripe
   price. They are made by hand in the dashboard and their ids pasted into
   STRIPE_PRICE_EXECUTIVE and STRIPE_PRICE_TEAM. */

export type PassId = "executive" | "team";

export const PASS_IDS: readonly PassId[] = ["executive", "team"];

export function isPassId(v: unknown): v is PassId {
  return typeof v === "string" && (PASS_IDS as readonly string[]).includes(v);
}

export type Pass = {
  id: PassId;
  name: string;
  /** advertised amount in whole currency units */
  price: number;
  priceLabel: string;
  currency: string;
  /** named attendee places included AND capacity consumed */
  places: number;
  priceEnvVar: string;
};

export function pass(id: PassId): Pass {
  const p = eventConfig.passes[id];
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    priceLabel: p.priceLabel,
    currency: p.currency,
    places: p.places,
    priceEnvVar: p.priceEnvVar,
  };
}

/* What Stripe must agree with before anyone reaches a card screen. Stripe
   reports amounts in the smallest currency unit and currency in lower case. */
export function expectedUnitAmount(id: PassId): number {
  return pass(id).price * 100;
}
export function expectedCurrency(id: PassId): string {
  return pass(id).currency.toLowerCase();
}

export type PriceLookup = { ok: true; priceId: string } | { ok: false; error: string };

/* No fallback and no default, deliberately. A price the code invented is a
   price nobody agreed to, so a missing or malformed one is refused by name and
   nobody is charged. */
export function priceIdFor(id: PassId): PriceLookup {
  const envVar = pass(id).priceEnvVar;
  const value = String(process.env[envVar] ?? "").trim();

  if (!value) {
    return {
      ok: false,
      error:
        `No Stripe price is set for the ${pass(id).name}, so no payment can be ` +
        `taken. Set ${envVar} in the environment.`,
    };
  }
  if (!value.startsWith("price_")) {
    return {
      ok: false,
      error:
        `${envVar} does not look like a Stripe price id (it should start with ` +
        `"price_"). Refusing to use it.`,
    };
  }
  return { ok: true, priceId: value };
}
