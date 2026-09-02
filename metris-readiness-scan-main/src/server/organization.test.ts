import { beforeEach, describe, expect, test } from "bun:test";

import { attendeeDisposition, classifyEmail, organizationKeyFor } from "./organization";

beforeEach(() => {
  delete process.env["ORGANIZATION_KEY_OVERRIDES"];
});

describe("organizational identity", () => {
  test("a corporate address proceeds and yields an organization key", () => {
    const id = classifyEmail("jane@bigcarehealth.com");
    expect(id.kind).toBe("corporate");
    expect(id.disposition).toBe("proceed");
    expect(id.organizationKey).toBe("bigcarehealth.com");
  });

  test("consumer mailboxes are routed to review, never refused", () => {
    for (const e of [
      "a@gmail.com",
      "a@yahoo.com",
      "a@hotmail.com",
      "a@outlook.com",
      "a@icloud.com",
      "a@proton.me",
    ]) {
      const id = classifyEmail(e);
      expect(id.kind).toBe("consumer");
      /* review, NOT refuse — an unusual domain is often a real customer */
      expect(id.disposition).toBe("review");
      expect(id.organizationKey).toBe("");
    }
  });

  test("disposable mailboxes are tracked separately from consumer ones", () => {
    const id = classifyEmail("a@mailinator.com");
    expect(id.kind).toBe("disposable");
    expect(id.disposition).toBe("review");
  });

  test("a malformed address is the only outright refusal", () => {
    for (const e of ["", "not-an-email", "a@b", "@nowhere.com"]) {
      expect(classifyEmail(e).disposition).toBe("refuse");
    }
  });

  test("classification is case- and whitespace-insensitive", () => {
    expect(classifyEmail("  Jane@BigCare.COM  ").organizationKey).toBe("bigcare.com");
    expect(classifyEmail("A@GMAIL.COM").kind).toBe("consumer");
  });

  test("compound public suffixes are not truncated", () => {
    /* naive "last two labels" would collapse every .nhs.uk trust into one org */
    expect(classifyEmail("a@trust-one.nhs.uk").organizationKey).toBe("trust-one.nhs.uk");
    expect(classifyEmail("a@trust-two.nhs.uk").organizationKey).toBe("trust-two.nhs.uk");
  });
});

describe("organization key overrides", () => {
  test("a subsidiary maps onto its parent's key", () => {
    process.env["ORGANIZATION_KEY_OVERRIDES"] = JSON.stringify({
      "acquired-co.com": "parent-co.com",
    });
    expect(organizationKeyFor("acquired-co.com")).toBe("parent-co.com");
    expect(classifyEmail("a@acquired-co.com").organizationKey).toBe("parent-co.com");
  });

  test("malformed override config is ignored rather than taking registration down", () => {
    process.env["ORGANIZATION_KEY_OVERRIDES"] = "{not json";
    expect(organizationKeyFor("anything.com")).toBe("anything.com");
  });
});

describe("team attendee disposition", () => {
  const buyer = "bigcarehealth.com";

  test("same domain proceeds", () => {
    expect(attendeeDisposition("bob@bigcarehealth.com", buyer).disposition).toBe("proceed");
  });

  test("a different corporate domain goes to review, not rejection", () => {
    const d = attendeeDisposition("bob@acquired-co.com", buyer);
    expect(d.disposition).toBe("review");
    expect(d.reason).toContain("subsidiaries");
  });

  test("a consumer address on a team goes to review", () => {
    expect(attendeeDisposition("bob@gmail.com", buyer).disposition).toBe("review");
  });

  test("a malformed attendee address is refused", () => {
    expect(attendeeDisposition("nope", buyer).disposition).toBe("refuse");
  });

  test("an override makes a subsidiary attendee proceed without review", () => {
    process.env["ORGANIZATION_KEY_OVERRIDES"] = JSON.stringify({
      "acquired-co.com": "bigcarehealth.com",
    });
    expect(attendeeDisposition("bob@acquired-co.com", buyer).disposition).toBe("proceed");
  });
});
