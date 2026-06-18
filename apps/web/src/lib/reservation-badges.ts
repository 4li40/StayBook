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
        "bg-destructive/10 text-destructive border-destructive/25",
    };
  }

  switch (reservation.state) {
    case "active":
      return {
        label: "Active Stay",
        className:
          "bg-gold-container/30 text-on-gold-container border-gold-container/40",
      };
    case "upcoming":
      return {
        label: "Upcoming Stay",
        className:
          "bg-sage-container/10 text-on-sage-container border-sage-container/20",
      };
    case "past":
      return {
        label: "Past Stay",
        className:
          "bg-secondary text-muted-foreground border-border/40",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className:
          "bg-destructive/10 text-destructive border-destructive/25",
      };
  }
}
