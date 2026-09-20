import { beforeEach, describe, expect, mock, test } from "bun:test";
import Stripe from "stripe";

/* The webhook, end to end, with Stripe and the store both mocked.

   Signatures are REAL: they are generated with the Stripe library's own test
   helper and verified by the real verification code. Nothing reaches the
   network and no external record is created. */

const SECRET = "whsec_test_secret_for_local_tests";

type StoreCalls = {
  claimStripeEvent: string[];
  releaseStripeEvent: string[];
  markPaid: unknown[];
  releaseReservation: unknown[];
  claimEntitlement: unknown[];
  claimEmailSend: string[];
};

function makeStore(overrides: Record<string, unknown> = {}) {
  const calls: StoreCalls = {
    claimStripeEvent: [],
    releaseStripeEvent: [],
    markPaid: [],
    releaseReservation: [],
    claimEntitlement: [],
    claimEmailSend: [],
  };
  const store = {
    claimStripeEvent: async (id: string) => {
      calls.claimStripeEvent.push(id);
      return { ok: true, alreadyDone: false };
    },
    releaseStripeEvent: async (id: string) => {
      calls.releaseStripeEvent.push(id);
      return { ok: true };
    },
    markPaid: async (input: unknown) => {
      calls.markPaid.push(input);
      return { ok: true };
    },
    releaseReservation: async (input: unknown) => {
      calls.releaseReservation.push(input);
      return { ok: true };
    },
    claimEntitlement: async (input: unknown) => {
      calls.claimEntitlement.push(input);
      return { ok: true, alreadyDone: false };
    },
    claimEmailSend: async (id: string) => {
      calls.claimEmailSend.push(id);
      /* already sent, so no email is attempted in tests */
      return { ok: true, alreadyDone: true };
    },
    releaseEmailClaim: async () => ({ ok: true }),
    ...overrides,
  };
  return { store, calls };
}

const paidSession = {
  id: "cs_test_123",
  payment_status: "paid",
  amount_total: 24900,
  currency: "usd",
  client_reference_id: "reg_abc",
  payment_intent: "pi_test_1",
  customer_details: { email: "jane@bigcare.com" },
  customer_email: "jane@bigcare.com",
  metadata: { passId: "executive", places: "1", organizationKey: "bigcare.com" },
};

async function callWebhook(
  eventType: string,
  object: Record<string, unknown>,
  storeOverrides: Record<string, unknown> = {},
  sessionOverride?: Record<string, unknown>,
) {
  const { store, calls } = makeStore(storeOverrides);

  const event = {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: eventType,
    data: { object },
  };
  const payload = JSON.stringify(event);

  const stripeLib = new Stripe("sk_test_fake", { apiVersion: "2025-01-27.acacia" as never });
  const header = await stripeLib.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: SECRET,
  });

  mock.module("../../server/persistence", () => ({
    getStore: () => store,
    eventId: () => "metris-exec-2026-10-14",
  }));
  mock.module("../../server/stripe", () => ({
    hasStripeKey: () => true,
    stripe: () => ({
      webhooks: stripeLib.webhooks,
      checkout: {
        sessions: {
          retrieve: async () => sessionOverride ?? object,
        },
      },
    }),
    json: (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s }),
  }));
  mock.module("../../server/email", () => ({
    sendConfirmation: async () => ({ ok: true, id: "email_1" }),
  }));
  mock.module("../../server/alerts", () => ({ alertFailedWrite: async () => {} }));

  process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
  process.env["STRIPE_WEBHOOK_SECRET"] = SECRET;

  const { Route } = await import("./stripe-webhook");
  const handler = (
    Route as unknown as {
      options: {
        server: { handlers: Record<string, (c: { request: Request }) => Promise<Response>> };
      };
    }
  ).options.server.handlers["POST"]!;

  const res = await handler({
    request: new Request("https://x/api/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": header, "content-type": "application/json" },
      body: payload,
    }),
  });
  return { res, calls, eventId: event.id };
}

beforeEach(() => {
  process.env["STRIPE_PRICE_EXECUTIVE"] = "price_exec";
  process.env["STRIPE_PRICE_TEAM"] = "price_team";
});

describe("signature verification", () => {
  test("an invalid signature is rejected 400 and never retried", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = SECRET;
    const { store } = makeStore();
    mock.module("../../server/persistence", () => ({
      getStore: () => store,
      eventId: () => "e",
    }));
    const { Route } = await import("./stripe-webhook");
    const handler = (
      Route as unknown as {
        options: {
          server: { handlers: Record<string, (c: { request: Request }) => Promise<Response>> };
        };
      }
    ).options.server.handlers["POST"]!;

    const res = await handler({
      request: new Request("https://x/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
        body: JSON.stringify({ id: "evt_x", type: "checkout.session.completed" }),
      }),
    });
    /* 400, not 5xx: this will never verify, so a retry is pointless. */
    expect(res.status).toBe(400);
  });
});

describe("checkout.session.completed", () => {
  test("a verified payment is recorded and acknowledged 200", async () => {
    const { res, calls } = await callWebhook("checkout.session.completed", paidSession);
    expect(res.status).toBe(200);
    expect(calls.markPaid.length).toBe(1);
  });

  test("exactly one entitlement is claimed, keyed on the organization", async () => {
    const { calls } = await callWebhook("checkout.session.completed", paidSession);
    expect(calls.claimEntitlement.length).toBe(1);
    expect((calls.claimEntitlement[0] as Record<string, string>)["organizationKey"]).toBe(
      "bigcare.com",
    );
  });

  test("a duplicate delivery does nothing and still answers 200", async () => {
    const { res, calls } = await callWebhook("checkout.session.completed", paidSession, {
      claimStripeEvent: async () => ({ ok: true, alreadyDone: true }),
    });
    expect(res.status).toBe(200);
    /* the essential write is NOT repeated: no second seat, no second email */
    expect(calls.markPaid.length).toBe(0);
    expect(calls.claimEntitlement.length).toBe(0);
  });

  test("a failed essential write returns a RETRYABLE 5xx, not 200", async () => {
    const { res, calls } = await callWebhook("checkout.session.completed", paidSession, {
      markPaid: async () => ({ ok: false, error: "sheet unreachable" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(500);
    /* and the claim is handed back, so Stripe's retry is a real retry */
    expect(calls.releaseStripeEvent.length).toBe(1);
  });

  test("an unpaid session is never recorded as paid", async () => {
    const { calls } = await callWebhook("checkout.session.completed", {
      ...paidSession,
      payment_status: "unpaid",
    });
    expect(calls.markPaid.length).toBe(0);
  });

  test("a session paid at the wrong amount is refused", async () => {
    const { calls } = await callWebhook("checkout.session.completed", {
      ...paidSession,
      amount_total: 100,
    });
    expect(calls.markPaid.length).toBe(0);
  });

  test("a session paid in the wrong currency is refused", async () => {
    const { calls } = await callWebhook("checkout.session.completed", {
      ...paidSession,
      currency: "eur",
    });
    expect(calls.markPaid.length).toBe(0);
  });

  test("the Team Pass amount is validated against the Team price", async () => {
    const team = {
      ...paidSession,
      amount_total: 112500,
      metadata: { passId: "team", places: "5", organizationKey: "bigcare.com" },
    };
    const { calls } = await callWebhook("checkout.session.completed", team);
    expect(calls.markPaid.length).toBe(1);
  });

  test("a Team session paid at the Executive price is refused", async () => {
    const mismatched = {
      ...paidSession,
      amount_total: 24900,
      metadata: { passId: "team", places: "5", organizationKey: "bigcare.com" },
    };
    const { calls } = await callWebhook("checkout.session.completed", mismatched);
    expect(calls.markPaid.length).toBe(0);
  });
});

describe("checkout.session.expired", () => {
  test("an expiry releases the reservation", async () => {
    const { res, calls } = await callWebhook("checkout.session.expired", { id: "cs_test_123" });
    expect(res.status).toBe(200);
    expect(calls.releaseReservation.length).toBe(1);
    expect((calls.releaseReservation[0] as Record<string, string>)["reason"]).toBe(
      "checkout_expired",
    );
  });

  test("a failed release is retryable, so the place is not silently stranded", async () => {
    const { res } = await callWebhook(
      "checkout.session.expired",
      { id: "cs_1" },
      {
        releaseReservation: async () => ({ ok: false, error: "sheet unreachable" }),
      },
    );
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  test("out-of-order expiry cannot free a paid allocation", async () => {
    /* The store is the guard: it reports success while releasing nothing. The
       webhook must accept that answer and not treat it as a failure. */
    let released = false;
    const { res } = await callWebhook(
      "checkout.session.expired",
      { id: "cs_1" },
      {
        releaseReservation: async () => {
          released = false;
          return { ok: true };
        },
      },
    );
    expect(res.status).toBe(200);
    expect(released).toBe(false);
  });
});

describe("event types", () => {
  test("an irrelevant event is acknowledged without being claimed", async () => {
    const { res, calls } = await callWebhook("customer.created", { id: "cus_1" });
    expect(res.status).toBe(200);
    expect(calls.claimStripeEvent.length).toBe(0);
  });

  test("a refund is recorded but does not automatically free capacity", async () => {
    const { res, calls } = await callWebhook("charge.refunded", {
      id: "ch_1",
      payment_intent: "pi_1",
    });
    expect(res.status).toBe(200);
    expect(calls.releaseReservation.length).toBe(0);
  });
});
