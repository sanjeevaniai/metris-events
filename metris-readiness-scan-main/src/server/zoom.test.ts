import { beforeEach, describe, expect, test } from "bun:test";

import { registerAttendee, zoomConfigured, ZOOM_NOT_CONFIGURED } from "./zoom";

/* Individual Zoom registration is NOT implemented. These tests exist to make
   that fact fail loudly the moment somebody assumes otherwise. */

beforeEach(() => {
  for (const k of ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_WEBINAR_ID"]) {
    delete process.env[k];
  }
});

const attendee = {
  email: "jane@bigcarehealth.com",
  firstName: "Jane",
  lastName: "Doe",
  organization: "BigCare Health",
};

test("Zoom is not configured, so individual registration is impossible", () => {
  expect(zoomConfigured()).toBe(false);
});

test("registering an attendee refuses, and says exactly why", async () => {
  const r = await registerAttendee(attendee);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.blocked).toBe(true);
    expect(r.error).toBe(ZOOM_NOT_CONFIGURED);
  }
});

test("it NEVER falls back to a shared link, even when one is in the environment", async () => {
  /* The old ZOOM_JOIN_URL must not resurrect itself as a fallback. */
  process.env["ZOOM_JOIN_URL"] = "https://zoom.us/j/999?pwd=shared";
  const r = await registerAttendee(attendee);
  expect(r.ok).toBe(false);
  expect(JSON.stringify(r)).not.toContain("zoom.us/j/999");
  delete process.env["ZOOM_JOIN_URL"];
});

test("credentials present but unimplemented still refuses rather than guessing", async () => {
  process.env["ZOOM_ACCOUNT_ID"] = "a";
  process.env["ZOOM_CLIENT_ID"] = "b";
  process.env["ZOOM_CLIENT_SECRET"] = "c";
  process.env["ZOOM_WEBINAR_ID"] = "d";
  expect(zoomConfigured()).toBe(true);
  const r = await registerAttendee(attendee);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toContain("not implemented");
});
