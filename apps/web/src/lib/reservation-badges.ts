import type { Badge } from "@StayBook/ui/components/badge";

import type { ReservationDerivedState, ReservationStatus } from "./api";

export function statusBadgeVariant(
  status: ReservationStatus,
): React.ComponentProps<typeof Badge>["variant"] {
  return status === "cancelled" ? "destructive" : "default";
}

export function stateBadgeVariant(
  state: ReservationDerivedState,
): React.ComponentProps<typeof Badge>["variant"] {
  switch (state) {
    case "active":
      return "default";
    case "upcoming":
      return "secondary";
    case "past":
      return "outline";
    case "cancelled":
      return "destructive";
  }
}

export function reservationBadgePresentation(reservation: {
  status: ReservationStatus;
  state: ReservationDerivedState;
}) {
  if (reservation.status === "cancelled") {
    return {
      label: "Cancelled",
      className:
        "bg-destructive/15 text-destructive border-destructive shadow-sm",
    };
  }

  switch (reservation.state) {
    case "active":
      return {
        label: "Active Stay",
        className:
          "bg-gold-container text-on-gold-container border-gold-container shadow-sm",
      };
    case "upcoming":
      return {
        label: "Upcoming Stay",
        className:
          "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-fixed shadow-sm",
      };
    case "past":
      return {
        label: "Past Stay",
        className:
          "bg-muted-foreground text-background border-muted-foreground shadow-sm",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className:
          "bg-destructive/15 text-destructive border-destructive shadow-sm",
      };
  }
}
