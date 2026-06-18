import { Button } from "@StayBook/ui/components/button";
import { Card, CardContent, CardTitle } from "@StayBook/ui/components/card";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { PaginationControls } from "@/components/pagination-controls";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BedDouble, CalendarX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  apiRequest,
  getErrorMessage,
  type Reservation,
  type ReservationsResponse,
} from "@/lib/api";
import { isMoreThan24HoursBeforeCheckIn } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { reservationBadgePresentation } from "@/lib/reservation-badges";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
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
  
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"upcoming" | "active" | "past" | "cancelled" | "all">("upcoming");
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  } | null>(null);

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const stateParam = activeTab !== "all" ? `&state=${activeTab}` : "";
      const data = await apiRequest<ReservationsResponse>(
        `/api/reservations/me?page=${page}&pageSize=5${stateParam}`
      );
      setReservations(data.reservations);
      setPagination(data.pagination);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [page, activeTab]);

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

  const emptyStates = {
    upcoming: {
      title: "No Upcoming Stays",
      description: "You have no upcoming trips booked at the moment. Explore our curated collections to plan your next stay.",
      actionText: "Browse Rooms"
    },
    active: {
      title: "No Stays In Progress",
      description: "You have no stays currently in progress.",
      actionText: "Browse Rooms"
    },
    past: {
      title: "No Past Stays",
      description: "Your completed trips will appear here.",
      actionText: "Browse Rooms"
    },
    cancelled: {
      title: "No Cancelled Stays",
      description: "You have no cancelled reservations.",
      actionText: "Browse Rooms"
    },
    all: {
      title: "No Stays Found",
      description: "No stays found in your account history.",
      actionText: "Book Your First Stay"
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-heading text-foreground tracking-tight">
            Welcome, {session.data?.user.name}
          </h1>
          <p className="text-sm text-muted-foreground font-sans">
            View and manage your reservations and stay history.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadReservations} disabled={isLoading} className="cursor-pointer">
          <RefreshCw data-icon="inline-start" className="h-4 w-4" />
          Refresh
        </Button>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex border-b border-border/60 gap-6 overflow-x-auto pb-1 scrollbar-thin">
        {[
          { id: "upcoming", label: "Upcoming" },
          { id: "active", label: "Active" },
          { id: "past", label: "Past" },
          { id: "cancelled", label: "Cancelled" },
          { id: "all", label: "All" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id as any);
              setPage(1);
            }}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-6" aria-live="polite">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="overflow-hidden border border-ghost-border bg-card flex flex-col md:flex-row items-stretch">
                <Skeleton className="w-full md:w-48 aspect-[4/3] md:aspect-auto md:h-auto flex-shrink-0" />
                <div className="flex-1 p-6 flex flex-col gap-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full mt-4" />
                </div>
              </Card>
            ))
          : null}

        {!isLoading && reservations.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-xl border border-ghost-border bg-card p-12 text-center shadow-xs">
            <CalendarX aria-hidden="true" className="text-muted-foreground/40 size-12" />
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-2xl text-foreground tracking-tight">
                {emptyStates[activeTab].title}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {emptyStates[activeTab].description}
              </p>
            </div>
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:opacity-90 mt-2">
              {emptyStates[activeTab].actionText}
            </Link>
          </div>
        ) : null}

        {!isLoading
          ? reservations.map((reservation) => {
              const isCancellable = reservation.status !== "cancelled" && isMoreThan24HoursBeforeCheckIn(reservation.checkInDate);
              const badge = reservationBadgePresentation(reservation);

              return (
                <Card key={reservation.id} className="overflow-hidden border border-ghost-border bg-card flex flex-col md:flex-row items-stretch shadow-xs hover:shadow-sm transition-all duration-300">
                  <div className="relative w-full md:w-48 aspect-[4/3] md:aspect-auto md:h-auto bg-muted flex-shrink-0 border-b md:border-b-0 md:border-r border-border/30">
                    {reservation.room.primaryPhotoUrl ? (
                      <img
                        src={reservation.room.primaryPhotoUrl}
                        alt={reservation.room.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted/40">
                        <BedDouble className="text-muted-foreground/60 size-6" />
                      </div>
                    )}
                    <span
                      className={`absolute top-3 left-3 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-6 justify-between gap-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <h2 className="font-heading text-2xl text-foreground tracking-tight">{reservation.room.name}</h2>
                        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/80 mt-1">
                          {reservation.room.type} · {formatDate(reservation.checkInDate)} – {formatDate(reservation.checkOutDate)}
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Total Price</span>
                        <p className="text-xl font-bold text-foreground tabular-nums">{formatCents(reservation.totalPrice)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border/30 pt-4 gap-4">
                      <div className="flex items-center gap-6 text-xs text-muted-foreground/90 font-sans">
                        <div>
                          <span className="font-semibold text-muted-foreground/80 block text-[9px] uppercase tracking-wider mb-0.5">Status</span>
                          <span className="capitalize font-bold text-foreground">{reservation.status}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-muted-foreground/80 block text-[9px] uppercase tracking-wider mb-0.5">Reserved On</span>
                          <span className="font-bold text-foreground">{dateFormatter.format(new Date(reservation.createdAt))}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch sm:items-end gap-1.5">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => cancelReservation(reservation)}
                          disabled={reservation.status === "cancelled" || !isCancellable || cancellingId === reservation.id}
                          className="cursor-pointer text-xs font-semibold uppercase tracking-wider px-4 py-2 h-9"
                        >
                          {cancellingId === reservation.id ? "Cancelling…" : "Cancel Reservation"}
                        </Button>
                        {!isCancellable && reservation.status !== "cancelled" && reservation.state === "upcoming" && (
                          <span className="text-[10px] font-semibold text-destructive/90 uppercase tracking-wider text-center sm:text-right">
                            Non-refundable (within 24h of check-in)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          : null}

        {/* Pagination UI */}
        {!isLoading && pagination && pagination.pageCount > 1 ? (
          <PaginationControls
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            pageCount={pagination.pageCount}
            onPageChange={setPage}
          />
        ) : null}
      </section>
    </main>
  );
}
