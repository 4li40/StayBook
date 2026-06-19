import { Button } from "@StayBook/ui/components/button";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { PaginationControls } from "@/components/pagination-controls";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BedDouble, CalendarClock, CalendarX, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  apiRequest,
  getErrorMessage,
  type Reservation,
} from "@/lib/api";
import { isMoreThan24HoursBeforeCheckIn } from "@/lib/dates";
import { formatCents, formatStayDate, formatTimestamp } from "@/lib/format";
import { myReservationsQueryOptions, reservationKeys } from "@/lib/queries";
import { reservationBadgePresentation } from "@/lib/reservation-badges";

export const Route = createFileRoute("/_auth/dashboard")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      ...myReservationsQueryOptions({
        page: 1,
        pageSize: 5,
        state: "upcoming",
      }),
      revalidateIfStale: true,
    }),
  component: RouteComponent,
});

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Active" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
] as const;

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"upcoming" | "active" | "past" | "cancelled" | "all">("upcoming");
  const reservationsQuery = useQuery(
    myReservationsQueryOptions({
      page,
      pageSize: 5,
      state: activeTab,
    }),
  );
  const reservations = reservationsQuery.data?.reservations ?? [];
  const pagination = reservationsQuery.data?.pagination ?? null;
  const isLoading = reservationsQuery.isPending;
  const errorMessage = reservationsQuery.error
    ? getErrorMessage(reservationsQuery.error)
    : null;

  async function cancelReservation(reservation: Reservation) {
    const confirmed = window.confirm(
      `Cancel your reservation for ${reservation.room.name} on ${formatStayDate(
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
      await queryClient.invalidateQueries({ queryKey: reservationKeys.mine() });
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
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-6 pt-28 pb-24">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            <span aria-hidden="true" className="h-px w-8 bg-gold/50" />
            Welcome, {session.user.name}
          </span>
          <h1 className="font-heading text-4xl md:text-5xl text-foreground tracking-tight leading-[1.1]">
            My Reservations
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
            Manage your upcoming journeys and revisit your past stays.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => reservationsQuery.refetch()}
          disabled={isLoading || reservationsQuery.isFetching}
          className="cursor-pointer h-11 rounded-full px-6 text-xs font-semibold uppercase tracking-widest"
        >
          <RefreshCw data-icon="inline-start" className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex gap-8 border-b border-border/60 overflow-x-auto whitespace-nowrap scrollbar-thin">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`py-3 text-xs font-bold uppercase tracking-[0.12em] border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? "border-gold text-foreground"
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
              <div
                key={index}
                className="flex flex-col md:flex-row gap-6 rounded-xl border border-ghost-border bg-card p-4 md:p-6 overflow-hidden"
              >
                <Skeleton className="w-full md:w-64 h-48 rounded-lg flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-5">
                  <div className="flex justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-7 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 border-t border-border/30 pt-5">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              </div>
            ))
          : null}

        {!isLoading && reservations.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 p-12 md:p-16 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-muted">
              <CalendarX aria-hidden="true" className="text-muted-foreground/50 size-9" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-2xl text-foreground tracking-tight">
                {emptyStates[activeTab].title}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {emptyStates[activeTab].description}
              </p>
            </div>
            <Link
              to="/rooms"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-all hover:opacity-90 mt-2"
            >
              {emptyStates[activeTab].actionText}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        {!isLoading
          ? reservations.map((reservation) => {
              const isCancellable = reservation.status !== "cancelled" && isMoreThan24HoursBeforeCheckIn(reservation.checkInDate);
              const badge = reservationBadgePresentation(reservation);

              return (
                <article
                  key={reservation.id}
                  className="group flex flex-col md:flex-row gap-6 rounded-xl border border-ghost-border bg-card p-4 md:p-6 shadow-[0_4px_20px_rgba(26,43,60,0.05)] transition-all duration-300 hover:shadow-[0_12px_36px_rgba(26,43,60,0.08)] hover:border-border/80"
                >
                  <div className="relative w-full md:w-64 h-48 rounded-lg overflow-hidden shrink-0 bg-muted">
                    {reservation.room.primaryPhotoUrl ? (
                      <img
                        src={reservation.room.primaryPhotoUrl}
                        alt={reservation.room.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted/40">
                        <BedDouble aria-hidden="true" className="text-muted-foreground/60 size-8" />
                      </div>
                    )}
                    <span
                      className={`absolute top-3 left-3 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex flex-col gap-1.5">
                        <h2 className="font-heading text-2xl text-foreground tracking-tight leading-tight">
                          {reservation.room.name}
                        </h2>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <BedDouble aria-hidden="true" className="size-4 text-muted-foreground/70" />
                          {reservation.room.type}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 block mb-0.5">
                          Total Price
                        </span>
                        <p className="font-heading text-2xl text-gold tabular-nums">
                          {formatCents(reservation.totalPrice)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-border/30 pt-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                          Check-in
                        </span>
                        <p className="text-sm font-semibold text-foreground">
                          {formatStayDate(reservation.checkInDate)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                          Check-out
                        </span>
                        <p className="text-sm font-semibold text-foreground">
                          {formatStayDate(reservation.checkOutDate)}
                        </p>
                      </div>
                      <div className="col-span-2 md:col-span-1 flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                          Guests
                        </span>
                        <p className="text-sm font-semibold text-foreground">
                          Up to {reservation.room.maxGuests}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border/30 pt-4">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
                        <CalendarClock aria-hidden="true" className="size-3.5" />
                        Booked on {formatTimestamp(reservation.createdAt)}
                      </p>
                      <div className="flex flex-col items-stretch sm:items-end gap-1.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            to="/rooms/$roomId"
                            params={{ roomId: reservation.room.id }}
                            search={{
                              checkInDate: reservation.checkInDate,
                              checkOutDate: reservation.checkOutDate,
                              guests: String(reservation.room.maxGuests),
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-4 h-9 text-xs font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary/5"
                          >
                            View Room
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => cancelReservation(reservation)}
                            disabled={reservation.status === "cancelled" || !isCancellable || cancellingId === reservation.id}
                            className="cursor-pointer h-9 rounded-lg px-4 text-xs font-semibold uppercase tracking-wider"
                          >
                            {cancellingId === reservation.id ? "Cancelling…" : "Cancel Reservation"}
                          </Button>
                        </div>
                        {!isCancellable && reservation.status !== "cancelled" && reservation.state === "upcoming" && (
                          <span className="text-[10px] font-semibold text-destructive/90 uppercase tracking-wider text-center sm:text-right">
                            Non-refundable (within 24h of check-in)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          : null}

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
