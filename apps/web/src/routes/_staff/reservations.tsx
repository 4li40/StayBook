import { Badge } from "@StayBook/ui/components/badge";
import { Button } from "@StayBook/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@StayBook/ui/components/select";
import { Textarea } from "@StayBook/ui/components/textarea";
import { PaginationControls } from "@/components/pagination-controls";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BedDouble,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  History,
  ListFilter,
  Mail,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiClientError,
  apiRequest,
  getErrorMessage,
  type ReservationDerivedState,
  type ReservationStatus,
  type StaffReservation,
  type StaffReservationFilters,
} from "@/lib/api";
import { formatCents, formatStayDate, formatStayDateTime, formatTimestamp } from "@/lib/format";
import {
  staffReservationKeys,
  staffReservationsQueryOptions,
  staffRoomsQueryOptions,
} from "@/lib/queries";
import { stateBadgeVariant, statusBadgeVariant } from "@/lib/reservation-badges";

export const Route = createFileRoute("/_staff/reservations")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({
        ...staffRoomsQueryOptions({}),
        revalidateIfStale: true,
      }),
      queryClient.ensureQueryData({
        ...staffReservationsQueryOptions(toFilters(emptyFilterForm, 1)),
        revalidateIfStale: true,
      }),
    ]),
  component: RouteComponent,
});

const PAGE_SIZE = 10;

const statusOptions: Array<{ value: ReservationStatus; label: string }> = [
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

const stateOptions: Array<{
  value: ReservationDerivedState;
  label: string;
}> = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
];

type FilterForm = {
  roomId: string;
  status: string;
  state: string;
  dateFrom: string;
  dateTo: string;
};

type FilterFieldErrors = Partial<
  Record<keyof FilterForm | "form", string>
>;

const emptyFilterForm: FilterForm = {
  roomId: "",
  status: "",
  state: "",
  dateFrom: "",
  dateTo: "",
};

function toFilters(
  form: FilterForm,
  page: number,
): StaffReservationFilters {
  return {
    page,
    pageSize: PAGE_SIZE,
    roomId: form.roomId || undefined,
    status:
      (form.status || undefined) as StaffReservationFilters["status"],
    state:
      (form.state || undefined) as StaffReservationFilters["state"],
    dateFrom: form.dateFrom || undefined,
    dateTo: form.dateTo || undefined,
  };
}

function validateFilterForm(form: FilterForm): FilterFieldErrors {
  const errors: FilterFieldErrors = {};

  if ((form.dateFrom && !form.dateTo) || (!form.dateFrom && form.dateTo)) {
    if (!form.dateFrom) {
      errors.dateFrom = "Provide both dates or leave both empty.";
    }
    if (!form.dateTo) {
      errors.dateTo = "Provide both dates or leave both empty.";
    }
  }

  if (form.dateFrom && form.dateTo && form.dateTo <= form.dateFrom) {
    errors.dateTo = "Date to must be after date from.";
  }

  if (form.status === "confirmed" && form.state === "cancelled") {
    errors.state = "State cannot be 'Cancelled' when status is 'Confirmed'.";
  }

  if (
    form.status === "cancelled" &&
    form.state &&
    form.state !== "cancelled"
  ) {
    errors.state = `State cannot be '${
      stateOptions.find((option) => option.value === form.state)?.label
    }' when status is 'Cancelled'.`;
  }

  return errors;
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const staffUser = session.user;

  const [filterForm, setFilterForm] = useState<FilterForm>(emptyFilterForm);
  const [appliedFilters, setAppliedFilters] = useState<StaffReservationFilters>(
    toFilters(emptyFilterForm, 1),
  );
  const [filterErrors, setFilterErrors] = useState<FilterFieldErrors>({});

  const roomsQuery = useQuery(staffRoomsQueryOptions({}));
  const reservationsQuery = useQuery(
    staffReservationsQueryOptions(appliedFilters),
  );
  const rooms = roomsQuery.data?.rooms ?? [];
  const reservations = reservationsQuery.data?.reservations ?? [];
  const pagination = reservationsQuery.data?.pagination ?? {
    page: appliedFilters.page ?? 1,
    pageSize: appliedFilters.pageSize ?? PAGE_SIZE,
    total: 0,
    pageCount: 0,
  };
  const isLoadingRooms = roomsQuery.isPending;
  const isLoading = reservationsQuery.isPending;
  const roomsError = roomsQuery.error ? getErrorMessage(roomsQuery.error) : null;
  const reservationsError = reservationsQuery.error
    ? getErrorMessage(reservationsQuery.error)
    : null;

  const [cancellingReservation, setCancellingReservation] =
    useState<StaffReservation | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelFieldError, setCancelFieldError] = useState<string | null>(
    null,
  );

  const stateCounts = useMemo(() => {
    return reservations.reduce<Record<ReservationDerivedState, number>>(
      (counts, reservation) => {
        counts[reservation.state] += 1;
        return counts;
      },
      { upcoming: 0, active: 0, past: 0, cancelled: 0 },
    );
  }, [reservations]);

  function updateFilterField<Key extends keyof FilterForm>(
    key: Key,
    value: FilterForm[Key],
  ) {
    setFilterForm((current) => ({ ...current, [key]: value }));
    setFilterErrors((current) => ({
      ...current,
      [key]: undefined,
      form: undefined,
    }));
  }

  function applyFilters() {
    const errors = validateFilterForm(filterForm);
    setFilterErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setAppliedFilters(toFilters(filterForm, 1));
  }

  function resetFilters() {
    setFilterForm(emptyFilterForm);
    setFilterErrors({});
    setAppliedFilters(toFilters(emptyFilterForm, 1));
  }

  function goToPage(page: number) {
    const next = Math.max(1, Math.min(page, pagination.pageCount || 1));
    if (next === appliedFilters.page) {
      return;
    }
    setAppliedFilters((current) => ({ ...current, page: next }));
  }

  function openCancelModal(reservation: StaffReservation) {
    setCancellingReservation(reservation);
    setCancellationReason("");
    setCancelError(null);
    setCancelFieldError(null);
  }

  function closeCancelModal() {
    if (isCancelling) {
      return;
    }
    setCancellingReservation(null);
    setCancellationReason("");
    setCancelError(null);
    setCancelFieldError(null);
  }

  async function confirmCancellation() {
    if (!cancellingReservation) {
      return;
    }

    const reason = cancellationReason.trim();
    if (reason.length > 500) {
      setCancelFieldError("Reason must be 500 characters or fewer.");
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    setCancelFieldError(null);

    try {
      await apiRequest(
        `/api/staff/reservations/${cancellingReservation.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            cancellationReason: reason || undefined,
          }),
        },
      );

      toast.success("Reservation cancelled.");
      await queryClient.invalidateQueries({
        queryKey: staffReservationKeys.lists(),
      });
      closeCancelModal();
    } catch (error) {
      let reasonError: string | null = null;
      let nonReasonError: string | null = null;

      if (error instanceof ApiClientError) {
        const issues = error.issues ?? [];
        const reasonIssue = issues.find((issue) =>
          issue.path.includes("cancellationReason"),
        );
        const otherIssues = issues.filter(
          (issue) => !issue.path.includes("cancellationReason"),
        );

        if (reasonIssue) {
          reasonError = reasonIssue.message;
        }

        if (otherIssues.length > 0) {
          nonReasonError = [
            error.message,
            ...otherIssues.map((issue) => issue.message),
          ].join(" ");
        } else if (!reasonIssue) {
          nonReasonError = getErrorMessage(error);
        }
      } else {
        nonReasonError = getErrorMessage(error);
      }

      setCancelFieldError(reasonError);
      if (nonReasonError) {
        setCancelError(nonReasonError);
        toast.error(nonReasonError);
      } else {
        setCancelError(null);
      }
    } finally {
      setIsCancelling(false);
    }
  }

  const showEmptyState = !isLoading && reservations.length === 0;
  const hasActiveFilters =
    Boolean(
      appliedFilters.roomId ||
        appliedFilters.status ||
        appliedFilters.state ||
        appliedFilters.dateFrom ||
        appliedFilters.dateTo,
    ) || appliedFilters.page !== 1;

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 pb-24 pt-28">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-8 text-primary-foreground shadow-[0_18px_60px_rgba(4,22,39,0.16)] sm:px-8 md:py-10">
        <div className="absolute -right-16 -top-24 size-64 rounded-full border border-white/10" />
        <div className="absolute -right-8 -top-16 size-40 rounded-full border border-gold-container/20" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-container">
              Guest operations
            </span>
            <h1 className="font-heading text-4xl tracking-tight text-balance sm:text-5xl">
              Reservations
            </h1>
            <p className="max-w-xl text-sm leading-6 text-primary-foreground/70 sm:text-base">
              Welcome back, {staffUser.name}. Follow every stay from confirmation through departure, all in one calm view.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-fit border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={() => {
              void roomsQuery.refetch();
              void reservationsQuery.refetch();
            }}
            disabled={
              isLoading ||
              isLoadingRooms ||
              roomsQuery.isFetching ||
              reservationsQuery.isFetching
            }
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </div>
      </section>

      {roomsError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {roomsError}
        </div>
      ) : null}

      {reservationsError && Object.keys(filterErrors).length === 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {reservationsError}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Reservation summary">
        <Card className="border-0 shadow-[0_8px_28px_rgba(26,43,60,0.06)] ring-1 ring-foreground/5">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3">
            <div className="flex flex-col gap-1">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.14em]">
                Upcoming
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stateCounts.upcoming}
              </CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-gold-container text-on-gold-container">
              <CalendarClock aria-hidden="true" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-0 shadow-[0_8px_28px_rgba(26,43,60,0.06)] ring-1 ring-foreground/5">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3">
            <div className="flex flex-col gap-1">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.14em]">
                In house
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stateCounts.active}
              </CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
              <CalendarCheck aria-hidden="true" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-0 shadow-[0_8px_28px_rgba(26,43,60,0.06)] ring-1 ring-foreground/5">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3">
            <div className="flex flex-col gap-1">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.14em]">
                Completed
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stateCounts.past}
              </CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <History aria-hidden="true" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-0 shadow-[0_8px_28px_rgba(26,43,60,0.06)] ring-1 ring-foreground/5">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3">
            <div className="flex flex-col gap-1">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.14em]">
                Cancelled
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stateCounts.cancelled}
              </CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <CalendarX aria-hidden="true" />
            </div>
          </CardHeader>
        </Card>
      </section>

      <Card className="border-0 shadow-[0_8px_28px_rgba(26,43,60,0.05)] ring-1 ring-foreground/5">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-primary">
              <ListFilter aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-lg">Find a reservation</CardTitle>
              <CardDescription>
                Narrow reservations by room, status, operational state, or
                stay date range.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            {filterErrors.form ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {filterErrors.form}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-room">Room</Label>
                <Select
                  value={filterForm.roomId}
                  onValueChange={(value) =>
                    updateFilterField("roomId", String(value ?? ""))
                  }
                >
                  <SelectTrigger id="filter-room" className="w-full">
                    <SelectValue placeholder="All rooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All rooms</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                        {!room.active ? " (inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-status">Status</Label>
                <Select
                  value={filterForm.status}
                  onValueChange={(value) =>
                    updateFilterField("status", String(value ?? ""))
                  }
                >
                  <SelectTrigger id="filter-status" className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-state">State</Label>
                <Select
                  value={filterForm.state}
                  onValueChange={(value) =>
                    updateFilterField("state", String(value ?? ""))
                  }
                >
                  <SelectTrigger
                    id="filter-state"
                    className="w-full"
                    aria-invalid={Boolean(filterErrors.state)}
                  >
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All states</SelectItem>
                    {stateOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterErrors.state ? (
                  <p className="text-xs text-destructive">
                    {filterErrors.state}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-date-from">Stay date from</Label>
                <Input
                  id="filter-date-from"
                  type="date"
                  value={filterForm.dateFrom}
                  onChange={(event) =>
                    updateFilterField("dateFrom", event.target.value)
                  }
                  aria-invalid={Boolean(filterErrors.dateFrom)}
                />
                {filterErrors.dateFrom ? (
                  <p className="text-xs text-destructive">
                    {filterErrors.dateFrom}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-date-to">Stay date to</Label>
                <Input
                  id="filter-date-to"
                  type="date"
                  value={filterForm.dateTo}
                  onChange={(event) =>
                    updateFilterField("dateTo", event.target.value)
                  }
                  aria-invalid={Boolean(filterErrors.dateTo)}
                />
                {filterErrors.dateTo ? (
                  <p className="text-xs text-destructive">
                    {filterErrors.dateTo}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="px-4" disabled={isLoading}>
                <ListFilter data-icon="inline-start" />
                Apply filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                disabled={isLoading || !hasActiveFilters}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4" aria-live="polite">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
              Stay ledger
            </span>
            <h2 className="font-heading text-2xl tracking-tight">Guest stays</h2>
          </div>
          {!isLoading ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              {pagination.total}{" "}
              {pagination.total === 1 ? "reservation" : "reservations"}
            </p>
          ) : null}
        </div>
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="border-0 ring-1 ring-foreground/5">
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

        {showEmptyState ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
              <CalendarX aria-hidden="true" className="text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-heading text-lg text-foreground">
                No reservations found
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting or resetting the filters."
                  : "Reservations will appear here once guests start booking."}
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading
          ? reservations.map((reservation) => (
              <Card
                key={reservation.id}
                className="border-0 shadow-[0_6px_24px_rgba(26,43,60,0.05)] ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(26,43,60,0.09)]"
              >
                <CardHeader className="pb-1">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row">
                      <div className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted sm:w-48">
                        {reservation.room.primaryPhotoUrl ? (
                          <img
                            src={reservation.room.primaryPhotoUrl}
                            alt={reservation.room.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                          />
                        ) : (
                          <BedDouble
                            aria-hidden="true"
                            className="text-muted-foreground"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={statusBadgeVariant(reservation.status)}
                            className="capitalize"
                          >
                            {reservation.status}
                          </Badge>
                          <Badge
                            variant={stateBadgeVariant(reservation.state)}
                            className="capitalize"
                          >
                            {reservation.state}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1">
                          <CardDescription className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">
                            {reservation.room.type}
                          </CardDescription>
                          <CardTitle className="text-2xl tracking-tight">{reservation.room.name}</CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays aria-hidden="true" className="size-4" />
                            {formatStayDate(reservation.checkInDate)}
                          </span>
                          <span aria-hidden="true" className="text-border">→</span>
                          <span>{formatStayDate(reservation.checkOutDate)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-left md:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Stay total</p>
                      <p className="font-heading text-2xl text-gold tabular-nums">
                        {formatCents(reservation.totalPrice)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm">
                  <div className="grid gap-4 border-t border-border/60 pt-4 md:grid-cols-[1.4fr_1fr_1fr]">
                    <div className="flex items-start gap-2.5">
                      <UserRound
                        aria-hidden="true"
                        className="mt-0.5 size-4 text-muted-foreground"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                          Guest
                        </p>
                        <p className="truncate font-semibold">
                          {reservation.guest.name ?? "Unknown"}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Mail aria-hidden="true" className="size-3" />
                          {reservation.guest.email ?? "No email"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CalendarClock
                        aria-hidden="true"
                        className="mt-0.5 size-4 text-muted-foreground"
                      />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                          Booked
                        </p>
                        <p className="font-medium">
                          {formatTimestamp(reservation.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <BedDouble
                        aria-hidden="true"
                        className="mt-0.5 size-4 text-muted-foreground"
                      />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                          Reference
                        </p>
                        <p className="font-mono text-xs font-medium text-muted-foreground">
                          {reservation.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {reservation.status === "cancelled" ? (
                    <div className="rounded-lg bg-destructive/5 p-3 text-destructive">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                        Cancellation
                      </p>
                      <p className="font-medium">
                        {reservation.cancelledAt
                          ? formatStayDateTime(reservation.cancelledAt)
                          : "—"}
                      </p>
                      {reservation.cancellationReason ? (
                        <p className="mt-1 text-xs text-destructive/80">
                          “{reservation.cancellationReason}”
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="flex flex-col gap-2 border-border/60 bg-secondary/40 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => openCancelModal(reservation)}
                    disabled={reservation.status === "cancelled"}
                  >
                    {reservation.status === "cancelled"
                      ? "Already cancelled"
                      : "Cancel Reservation"}
                  </Button>
                </CardFooter>
              </Card>
            ))
          : null}
      </section>

      {!isLoading && reservations.length > 0 ? (
        <PaginationControls
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          pageCount={pagination.pageCount}
          onPageChange={goToPage}
        />
      ) : null}

      {cancellingReservation ? (
        <div
          className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-reservation-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCancelModal();
            }
          }}
        >
          <Card className="w-full max-w-lg overflow-hidden shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <CardTitle id="cancel-reservation-title">
                    Cancel Reservation
                  </CardTitle>
                  <CardDescription>
                    {cancellingReservation.room.name} ·{" "}
                    {formatStayDate(cancellingReservation.checkInDate)} to{" "}
                    {formatStayDate(cancellingReservation.checkOutDate)}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={closeCancelModal}
                  disabled={isCancelling}
                  aria-label="Close cancellation dialog"
                >
                  <X />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={statusBadgeVariant(
                        cancellingReservation.status,
                      )}
                      className="capitalize"
                    >
                      {cancellingReservation.status}
                    </Badge>
                    <Badge
                      variant={stateBadgeVariant(
                        cancellingReservation.state,
                      )}
                      className="capitalize"
                    >
                      {cancellingReservation.state}
                    </Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Guest:{" "}
                    <span className="font-medium text-foreground">
                      {cancellingReservation.guest.name ?? "Unknown"}
                    </span>
                    {cancellingReservation.guest.email
                      ? ` (${cancellingReservation.guest.email})`
                      : ""}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Total:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatCents(
                        cancellingReservation.totalPrice,
                      )}
                    </span>
                  </p>
                </div>

                {cancelError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {cancelError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="cancellation-reason">
                    Cancellation reason{" "}
                    <span className="text-xs text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="cancellation-reason"
                    value={cancellationReason}
                    onChange={(event) => {
                      setCancellationReason(event.target.value);
                      setCancelFieldError(null);
                      setCancelError(null);
                    }}
                    aria-invalid={Boolean(cancelFieldError)}
                    maxLength={500}
                    placeholder="Note why this reservation is being cancelled."
                  />
                  <p className="text-xs text-muted-foreground">
                    {cancellationReason.length}/500
                  </p>
                  {cancelFieldError ? (
                    <p className="text-xs text-destructive">
                      {cancelFieldError}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={confirmCancellation}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelling…" : "Confirm Cancellation"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCancelModal}
                    disabled={isCancelling}
                  >
                    <X data-icon="inline-start" />
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
