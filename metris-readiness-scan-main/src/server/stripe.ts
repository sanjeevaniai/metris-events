import "@tanstack/react-start/server-only";

import Stripe from "stripe";

let client: Stripe | undefined;

/* One client, made on first use rather than at import time, so a module that
   merely imports this does not blow up when the key is absent. */
export function stripe(): Stripe {
  const key = String(process.env["STRIPE_SECRET_KEY"] ?? "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set on the server.");
  if (!client) client = new Stripe(key);
  return client;
}

export function hasStripeKey(): boolean {
  return Boolean(String(process.env["STRIPE_SECRET_KEY"] ?? "").trim());
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* Stripe metadata values are capped, and a long free-text answer will happily
   exceed it. Trim rather than let the whole session creation fail. */
export function trim(v: unknown, max = 480): string {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}
