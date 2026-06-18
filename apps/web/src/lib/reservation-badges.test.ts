import { describe, expect, it } from "vitest";

import {
  reservationBadgePresentation,
  stateBadgeVariant,
  statusBadgeVariant,
} from "./reservation-badges";

describe("reservation badge presentation", () => {
  it("uses destructive styling for cancelled reservations", () => {
    expect(statusBadgeVariant("cancelled")).toBe("destructive");
    expect(stateBadgeVariant("cancelled")).toBe("destructive");
    expect(
      reservationBadgePresentation({
        status: "cancelled",
        state: "upcoming",
      }),
    ).toMatchObject({
      label: "Cancelled",
      className: expect.stringContaining("text-destructive"),
    });
  });

  it("labels operational reservation states clearly", () => {
    expect(
      reservationBadgePresentation({
        status: "confirmed",
        state: "upcoming",
      }).label,
    ).toBe("Upcoming Stay");
    expect(
      reservationBadgePresentation({
        status: "confirmed",
        state: "active",
      }).label,
    ).toBe("Active Stay");
    expect(
      reservationBadgePresentation({
        status: "confirmed",
        state: "past",
      }).label,
    ).toBe("Past Stay");
  });
});
