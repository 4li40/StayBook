import { Button } from "@StayBook/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  apiRequest,
  getErrorMessage,
  type Reservation,
  type ReservationsResponse,
} from "@/lib/api";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const moneyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiRequest<ReservationsResponse>("/api/reservations/me?pageSize=50");
      setReservations(data.reservations);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  async function cancelReservation(reservation: Reservation) {
    const confirmed = window.confirm(
      `Cancel your reservation for ${reservation.room.name} on ${formatDate(
        reservation.checkInDate,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    const reason = window.prompt("Cancellation reason");
    setCancellingId(reservation.id);

    try {
      await apiRequest(`/api/reservations/${reservation.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          cancellationReason: reason?.trim() || undefined,
        }),
      });
      toast.success("Reservation cancelled.");
      await loadReservations();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading text-foreground tracking-tight text-balance">
            Welcome, {session.data?.user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage your reservations.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadReservations} disabled={isLoading}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="flex flex-col gap-4" aria-live="polite">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))
          : null}

        {!isLoading && reservations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-10 text-center">
            <CalendarX aria-hidden="true" className="text-muted-foreground size-10" />
            <div className="flex flex-col gap-1.5">
              <h2 className="font-heading text-lg text-foreground">No Reservations Yet</h2>
              <p className="text-sm text-muted-foreground">
                Book a room from the home page and it will appear here.
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading
          ? reservations.map((reservation) => (
              <Card key={reservation.id}>
                <CardHeader>
                  <CardTitle>{reservation.room.name}</CardTitle>
                  <CardDescription className="capitalize">
                    {reservation.room.type} · {formatDate(reservation.checkInDate)} to{" "}
                    {formatDate(reservation.checkOutDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <p className="font-medium capitalize">{reservation.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Total</p>
                    <p className="font-medium tabular-nums">
                      {moneyFormatter.format(Number(reservation.totalPrice))}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Reserved</p>
                    <p className="font-medium">
                      {dateFormatter.format(new Date(reservation.createdAt))}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => cancelReservation(reservation)}
                    disabled={reservation.status === "cancelled" || cancellingId === reservation.id}
                  >
                    {cancellingId === reservation.id ? "Cancelling…" : "Cancel Reservation"}
                  </Button>
                </CardFooter>
              </Card>
            ))
          : null}
      </section>
    </main>
  );
}
