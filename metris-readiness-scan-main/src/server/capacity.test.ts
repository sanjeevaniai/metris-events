import { describe, expect, test } from "bun:test";

import { eventConfig } from "../config/event";
import { availability, fits, operatingBuffer } from "./capacity";
import { expectedCurrency, expectedUnitAmount, pass } from "./passes";

/* Capacity and pricing arithmetic. Pure functions, no network, no store. */

describe("pricing", () => {
  test("Executive Pass is exactly $249 for 1 place", () => {
    expect(pass("executive").price).toBe(249);
    expect(pass("executive").places).toBe(1);
    expect(expectedUnitAmount("executive")).toBe(24900);
    expect(expectedCurrency("executive")).toBe("usd");
  });

  test("Team Pass is exactly $1,125 for 5 places", () => {
    expect(pass("team").price).toBe(1125);
    expect(pass("team").places).toBe(5);
    expect(expectedUnitAmount("team")).toBe(112500);
    expect(expectedCurrency("team")).toBe("usd");
  });

  test("each pass resolves its own Stripe price env var", () => {
    expect(pass("executive").priceEnvVar).toBe("STRIPE_PRICE_EXECUTIVE");
    expect(pass("team").priceEnvVar).toBe("STRIPE_PRICE_TEAM");
  });
});

describe("capacity configuration", () => {
  test("saleable is 450, platform is 500, buffer is 50", () => {
    expect(eventConfig.publicSaleableCapacity).toBe(450);
    expect(eventConfig.zoomPlatformCapacity).toBe(500);
    expect(operatingBuffer()).toBe(50);
  });

  test("the operating buffer is never saleable", () => {
    /* Everything sold, right to the configured limit. */
    const a = availability({ reserved: 0, paid: 450 });
    expect(a.remaining).toBe(0);
    expect(a.soldOut).toBe(true);
    /* 50 places still exist on the platform, and none of them are sellable. */
    expect(eventConfig.zoomPlatformCapacity - a.used).toBe(50);
  });
});

describe("availability", () => {
  test("empty event: both passes available", () => {
    const a = availability({ reserved: 0, paid: 0 });
    expect(a.remaining).toBe(450);
    expect(a.executiveAvailable).toBe(true);
    expect(a.teamAvailable).toBe(true);
    expect(a.soldOut).toBe(false);
  });

  test("reservations consume capacity as surely as payments do", () => {
    const a = availability({ reserved: 100, paid: 100 });
    expect(a.used).toBe(200);
    expect(a.remaining).toBe(250);
  });

  test("fewer than five places: Executive only, NOT sold out", () => {
    for (const remaining of [1, 2, 3, 4]) {
      const a = availability({ reserved: 0, paid: 450 - remaining });
      expect(a.remaining).toBe(remaining);
      expect(a.executiveAvailable).toBe(true);
      expect(a.teamAvailable).toBe(false);
      expect(a.soldOut).toBe(false);
    }
  });

  test("exactly five places: Team Pass is available again", () => {
    const a = availability({ reserved: 0, paid: 445 });
    expect(a.teamAvailable).toBe(true);
    expect(fits("team", { reserved: 0, paid: 445 })).toBe(true);
  });

  test("zero places: sold out, neither pass fits", () => {
    const a = availability({ reserved: 0, paid: 450 });
    expect(a.executiveAvailable).toBe(false);
    expect(a.teamAvailable).toBe(false);
    expect(a.soldOut).toBe(true);
    expect(fits("executive", { reserved: 0, paid: 450 })).toBe(false);
  });

  test("over-consumption never produces negative remaining capacity", () => {
    const a = availability({ reserved: 0, paid: 470 });
    expect(a.remaining).toBe(0);
    expect(a.soldOut).toBe(true);
  });

  test("a negative count cannot manufacture capacity", () => {
    const a = availability({ reserved: -100, paid: 450 });
    expect(a.remaining).toBe(0);
  });

  test("the last place goes to an Executive Pass, not a Team Pass", () => {
    const used = { reserved: 449, paid: 0 };
    expect(fits("executive", used)).toBe(true);
    expect(fits("team", used)).toBe(false);
  });
});
