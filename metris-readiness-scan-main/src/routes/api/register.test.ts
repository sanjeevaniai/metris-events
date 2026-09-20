import { beforeEach, describe, expect, mock, test } from "bun:test";

/* Registration validation and the organizational-identity gate.
   The store is mocked; nothing is written anywhere. */

type Saved = { registrations: unknown[]; attendees: unknown[] };

async function callRegister(body: unknown, storeOverrides: Record<string, unknown> = {}) {
  const saved: Saved = { registrations: [], attendees: [] };
  const store = {
    saveRegistration: async (row: unknown) => {
      saved.registrations.push(row);
      return { ok: true };
    },
    saveAttendees: async (rows: unknown[]) => {
      saved.attendees.push(...rows);
      return { ok: true };
    },
    ...storeOverrides,
  };
  mock.module("../../server/persistence", () => ({
    getStore: () => store,
    eventId: () => "metris-exec-2026-10-14",
  }));

  const { Route } = await import("./register");
  const handler = (
    Route as unknown as {
      options: {
        server: { handlers: Record<string, (c: { request: Request }) => Promise<Response>> };
      };
    }
  ).options.server.handlers["POST"]!;

  const res = await handler({
    request: new Request("https://x/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });
  return { res, json: (await res.json()) as Record<string, unknown>, saved };
}

const valid = {
  passId: "executive",
  firstName: "Jane",
  lastName: "Doe",
  businessEmail: "jane@bigcarehealth.com",
  jobTitle: "Chief Medical Officer",
  organization: "BigCare Health",
  organizationType: "provider",
  country: "United States",
  termsAccepted: true,
};

beforeEach(() => {
  delete process.env["ORGANIZATION_KEY_OVERRIDES"];
});

describe("validation", () => {
  test("a corporate registration succeeds and is verified", async () => {
    const { res, json } = await callRegister(valid);
    expect(res.status).toBe(200);
    expect(json["ok"]).toBe(true);
    expect(json["verificationState"]).toBe("verified");
    expect(String(json["registrationId"])).toStartWith("reg_");
  });

  test("malformed JSON is refused", async () => {
    const { res } = await callRegister("{not json");
    expect(res.status).toBe(400);
  });

  test("an unrecognized pass is refused rather than defaulted", async () => {
    const { res } = await callRegister({ ...valid, passId: "free" });
    expect(res.status).toBe(400);
  });

  test("every required field is enforced", async () => {
    for (const field of [
      "firstName",
      "lastName",
      "businessEmail",
      "jobTitle",
      "organization",
      "organizationType",
      "country",
    ]) {
      const { res } = await callRegister({ ...valid, [field]: "" });
      expect(res.status).toBe(400);
    }
  });

  test("terms must be accepted", async () => {
    const { res } = await callRegister({ ...valid, termsAccepted: false });
    expect(res.status).toBe(400);
  });

  test("NO SALES QUALIFICATION: any job title and org type register fine", async () => {
    for (const orgType of ["health_plan", "provider", "health_tech", "other"]) {
      for (const jobTitle of ["Intern", "CEO", "Janitor"]) {
        const { res } = await callRegister({
          ...valid,
          orgType,
          jobTitle,
          organizationType: orgType,
        });
        expect(res.status).toBe(200);
      }
    }
  });

  test("a store failure means no registration, and no payment", async () => {
    const { res } = await callRegister(valid, {
      saveRegistration: async () => ({ ok: false, error: "sheet unreachable" }),
    });
    expect(res.status).toBe(502);
  });
});

describe("organizational identity gate", () => {
  test("a consumer address is CAPTURED and routed to review, not rejected", async () => {
    const { res, json, saved } = await callRegister({
      ...valid,
      businessEmail: "jane@gmail.com",
    });
    expect(res.status).toBe(200);
    expect(json["verificationState"]).toBe("manual_review");
    expect(String(json["reviewNotice"])).toContain("business email");
    /* the lead is still recorded — this is a gate, not a bin */
    expect(saved.registrations.length).toBe(1);
  });

  test("a malformed address is the only outright refusal", async () => {
    const { res } = await callRegister({ ...valid, businessEmail: "not-an-email" });
    expect(res.status).toBe(400);
  });

  test("the organization key comes from the verified domain", async () => {
    const { saved } = await callRegister(valid);
    const row = saved.registrations[0] as Record<string, string>;
    expect(row["organizationKey"]).toBe("bigcarehealth.com");
    expect(row["verifiedDomain"]).toBe("bigcarehealth.com");
  });
});

describe("pass and attendees", () => {
  test("Executive reserves 1 place and names the purchaser", async () => {
    const { saved } = await callRegister(valid);
    const row = saved.registrations[0] as Record<string, number>;
    expect(row["purchasedPlaces"]).toBe(1);
    expect(saved.attendees.length).toBe(1);
  });

  test("Team reserves 5 places even when one name is supplied", async () => {
    const { saved } = await callRegister({
      ...valid,
      passId: "team",
      attendees: [{ name: "Jane Doe", email: "jane@bigcarehealth.com" }],
    });
    const row = saved.registrations[0] as Record<string, number>;
    expect(row["purchasedPlaces"]).toBe(5);
    /* one named attendee, five places held */
    expect(saved.attendees.length).toBe(1);
  });

  test("a duplicate attendee email is rejected", async () => {
    const { res, json } = await callRegister({
      ...valid,
      passId: "team",
      attendees: [
        { name: "A", email: "same@bigcarehealth.com" },
        { name: "B", email: "same@bigcarehealth.com" },
      ],
    });
    expect(res.status).toBe(400);
    expect(String(json["error"])).toContain("more than once");
  });

  test("more than five named attendees is refused with the contact line", async () => {
    const { res, json } = await callRegister({
      ...valid,
      passId: "team",
      attendees: Array.from({ length: 6 }, (_, i) => ({
        name: `P${i}`,
        email: `p${i}@bigcarehealth.com`,
      })),
    });
    expect(res.status).toBe(400);
    expect(String(json["error"])).toContain("Contact METRIS");
  });

  test("an attendee with a name but no email is refused", async () => {
    const { res } = await callRegister({
      ...valid,
      passId: "team",
      attendees: [{ name: "No Address" }],
    });
    expect(res.status).toBe(400);
  });

  test("a mismatched team domain is flagged for review, not rejected", async () => {
    const { res, json } = await callRegister({
      ...valid,
      passId: "team",
      attendees: [
        { name: "Jane", email: "jane@bigcarehealth.com" },
        { name: "Bob", email: "bob@acquired-co.com" },
      ],
    });
    expect(res.status).toBe(200);
    expect(json["attendeesNeedingReview"]).toEqual(["bob@acquired-co.com"]);
  });

  test("Zoom state starts blocked, never 'pending'", async () => {
    const { saved } = await callRegister(valid);
    const a = saved.attendees[0] as Record<string, string>;
    /* pending would imply credentials are coming; nothing can issue them yet */
    expect(a["zoomRegistrationState"]).toBe("blocked");
    expect(a["joinLinkDeliveryState"]).toBe("blocked");
  });

  test("marketing consent absent is null, not an empty string", async () => {
    const { saved } = await callRegister(valid);
    const row = saved.registrations[0] as Record<string, unknown>;
    expect(row["marketingConsentAt"]).toBeNull();
  });
});
