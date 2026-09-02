import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { eventConfig, eventMetaLine, eventTimeKnown, eventWhenLine, isPlaceholder } from "./event";

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) sourceFiles(p, acc);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) acc.push(p);
  }
  return acc;
}

describe("public date wording", () => {
  test("the date is October 14, 2026", () => {
    expect(eventConfig.date).toBe("October 14, 2026");
  });

  test("no bracketed placeholder ever reaches a visitor", () => {
    expect(isPlaceholder(eventMetaLine)).toBe(false);
    expect(eventMetaLine).not.toContain("[");
    expect(eventWhenLine).not.toContain("[");
  });

  test("the page reads 'October 14, 2026 · Time to be announced · Live online'", () => {
    expect(eventMetaLine).toBe("October 14, 2026 · Time to be announced · Live online");
  });

  test("page and email say exactly the same thing", () => {
    expect(eventWhenLine).toBe(eventMetaLine);
  });

  test("no calendar link may be generated while the time is unknown", () => {
    expect(eventTimeKnown).toBe(false);
  });
});

describe("commercial model", () => {
  test("two passes at $249 and $1,125", () => {
    expect(eventConfig.passes.executive.price).toBe(249);
    expect(eventConfig.passes.team.price).toBe(1125);
  });

  test("places are 1 and 5", () => {
    expect(eventConfig.passes.executive.places).toBe(1);
    expect(eventConfig.passes.team.places).toBe(5);
  });

  test("nothing offers unlimited attendance", () => {
    const blob = JSON.stringify(eventConfig).toLowerCase();
    expect(blob).not.toContain("unlimited");
  });

  test("the entitlement is per organization, not per pass or attendee", () => {
    expect(eventConfig.ctaSubline).toContain("per verified organization");
  });
});

describe("use-case availability", () => {
  test("prior authorization is the one assessment-ready use case", () => {
    const ready = eventConfig.useCases.filter((u) => u.status === "assessment_ready");
    expect(ready.length).toBe(1);
    expect(ready[0]!.id).toBe("prior-auth");
  });

  test("every other use case is a discussion example", () => {
    for (const u of eventConfig.useCases.filter((u) => u.id !== "prior-auth")) {
      expect(u.status).toBe("discussion_example");
    }
  });

  test("the four agreed cards, and only those", () => {
    expect(eventConfig.useCases.map((u) => u.id).sort()).toEqual([
      "claims",
      "clinical-documentation",
      "communications",
      "prior-auth",
    ]);
  });
});

describe("public wording boundaries", () => {
  const files = sourceFiles("src");

  test("METRIS-G and METRIS-W appear nowhere in the application", () => {
    const offenders = files.filter((f) => /metris[- _]?[gw]\b/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("no source file contains a hardcoded Zoom join link", () => {
    const offenders = files.filter((f) => /zoom\.us\/[jw]\//i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("no client-side file READS a secret from the environment", () => {
    /* Mentioning a variable in a comment is fine; reading one is not. This
       looks for an actual process.env access, which is the thing that could
       put a secret into a browser bundle. */
    const client = files.filter((f) => !f.includes("/server/") && !f.includes("/routes/api/"));
    const secretRead =
      /process\.env\s*\[\s*["'`](STRIPE_[A-Z_]*|SHEET_SHARED_SECRET|RESEND_API_KEY|ZOOM_[A-Z_]*)["'`]\s*\]/;
    const offenders = client.filter((f) => secretRead.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("the server import guard is configured, so a leak fails the BUILD", () => {
    /* The test above is a net; this is the actual control. importProtection
       makes any client import of src/server/** an error at build time. */
    const vite = readFileSync("vite.config.ts", "utf8");
    expect(vite).toContain("importProtection");
    expect(vite).toContain('behavior: "error"');
    expect(vite).toContain("**/server/**");
  });
});
