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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@StayBook/ui/components/select";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { Textarea } from "@StayBook/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
  BedDouble,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ApiClientError,
  apiRequest,
  buildStaffReservationsQuery,
  getErrorMessage,
  type ReservationDerivedState,
  type ReservationStatus,
  type StaffReservation,
  type StaffReservationFilters,
  type StaffReservationResponse,
  type StaffReservationsResponse,
  type StaffRoom,
  type StaffRoomsResponse,
} from "@/lib/api";
import { formatCents } from "@/lib/format";

export const Route = createFileRoute("/_staff/reservations")({
  component: RouteComponent,
});

const PAGE_SIZE = 10;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function formatTimestamp(value: string) {
  return dateFormatter.format(new Date(value));
}

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

function statusBadgeVariant(
  status: ReservationStatus,
): React.ComponentProps<typeof Badge>["variant"] {
  return status === "cancelled" ? "destructive" : "default";
}

function stateBadgeVariant(
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

function collectFilterErrors(error: unknown): FilterFieldErrors {
  if (!(error instanceof ApiClientError)) {
    return {};
  }

  return (error.issues ?? []).reduce<FilterFieldErrors>(
    (fieldErrors, issue) => {
      const field = issue.path.split(".")[0] as keyof FilterForm;
      if (field in emptyFilterForm && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
      return fieldErrors;
    },
    {},
  );
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const staffUser = session.data?.user;

  const [rooms, setRooms] = useState<StaffRoom[]>([]);
  const [reservations, setReservations] = useState<StaffReservation[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    pageCount: 0,
  });

  const [filterForm, setFilterForm] = useState<FilterForm>(emptyFilterForm);
  const [appliedFilters, setAppliedFilters] = useState<StaffReservationFilters>(
    toFilters(emptyFilterForm, 1),
  );
  const [filterErrors, setFilterErrors] = useState<FilterFieldErrors>({});

  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [reservationsError, setReservationsError] = useState<string | null>(
    null,
  );
  const requestIdRef = useRef(0);

  const [cancellingReservation, setCancellingReservation] =
    useState<StaffReservation | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelFieldError, setCancelFieldError] = useState<string | null>(
    null,
  );

  const loadRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomsError(null);
    try {
      const data = await apiRequest<StaffRoomsResponse>("/api/staff/rooms");
      setRooms(data.rooms);
    } catch (error) {
      setRooms([]);
      setRoomsError(getErrorMessage(error));
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  const loadReservations = useCallback(
    async (filters: StaffReservationFilters) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setReservationsError(null);

      try {
        const data = await apiRequest<StaffReservationsResponse>(
          `/api/staff/reservations${buildStaffReservationsQuery(filters)}`,
        );
        if (requestId !== requestIdRef.current) return;
        setReservations(data.reservations);
        setPagination(data.pagination);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setReservations([]);
        setPagination({
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? PAGE_SIZE,
          total: 0,
          pageCount: 0,
        });
        const fieldErrors = collectFilterErrors(error);
        const hasUnmappedIssues =
          error instanceof ApiClientError &&
          (error.issues?.some((issue) => {
            const field = issue.path.split(".")[0] as keyof FilterForm;
            return !(field in emptyFilterForm);
          }) ?? false);
        if (Object.keys(fieldErrors).length > 0 || hasUnmappedIssues) {
          setFilterErrors({
            ...fieldErrors,
            ...(hasUnmappedIssues ? { form: getErrorMessage(error) } : {}),
          });
        } else {
          setFilterErrors({});
          setReservationsError(getErrorMessage(error));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    loadReservations(appliedFilters);
  }, [appliedFilters, loadReservations]);

  const stateCounts = useMemo(() => {
    return reservations.reduce<Record<ReservationDerivedState, number>>(
      (counts, reservation) => {
        counts[reservation.state] += 1;
        return counts;
      },
      { upcoming: 0, active: 0, past: 0, cancelled: 0 },
    );
  }, [reservations]);

  if (!staffUser) {
    return null;
  }

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
      const data = await apiRequest<StaffReservationResponse>(
        `/api/staff/reservations/${cancellingReservation.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            cancellationReason: reason || undefined,
          }),
        },
      );

      toast.success("Reservation cancelled.");
      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === data.reservation.id
            ? data.reservation
            : reservation,
        ),
      );
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading text-foreground tracking-tight text-balance">
            Staff Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {staffUser.name}. Monitor, filter, and cancel guest
            reservations.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            loadRooms();
            loadReservations(appliedFilters);
          }}
          disabled={isLoading || isLoadingRooms}
        >
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
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

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>Upcoming</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stateCounts.upcoming}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stateCounts.active}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>Past</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stateCounts.past}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>Cancelled</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stateCounts.cancelled}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>
            Narrow reservations by room, status, operational state, or stay
            date range.
          </CardDescription>
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
              <Button type="submit" disabled={isLoading}>
                <RefreshCw data-icon="inline-start" />
                Apply Filters
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

        {showEmptyState ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-muted/30 p-10 text-center">
            <CalendarX aria-hidden="true" className="size-10 text-muted-foreground" />
            <div className="flex flex-col gap-1.5">
              <h2 className="font-heading text-lg text-foreground">
                No Reservations Found
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
              <Card key={reservation.id}>
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                      <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:w-40">
                        {reservation.room.primaryPhotoUrl ? (
                          <img
                            src={reservation.room.primaryPhotoUrl}
                            alt={reservation.room.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <BedDouble
                            aria-hidden="true"
                            className="text-muted-foreground"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <CardTitle>{reservation.room.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {reservation.room.type} ·{" "}
                          {formatDate(reservation.checkInDate)} to{" "}
                          {formatDate(reservation.checkOutDate)}
                        </CardDescription>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
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
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Guest</p>
                    <p className="truncate font-medium">
                      {reservation.guest.name ?? "Unknown"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {reservation.guest.email ?? "No email"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Total</p>
                    <p className="font-medium tabular-nums">
                      {formatCents(reservation.totalPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Reserved
                    </p>
                    <p className="font-medium">
                      {formatTimestamp(reservation.createdAt)}
                    </p>
                  </div>

                  {reservation.status === "cancelled" ? (
                    <div className="md:col-span-3">
                      <p className="mb-1 text-xs text-muted-foreground">
                        Cancellation
                      </p>
                      <p className="font-medium">
                        {reservation.cancelledAt
                          ? formatDateTime(reservation.cancelledAt)
                          : "—"}
                      </p>
                      {reservation.cancellationReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          “{reservation.cancellationReason}”
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
        <section className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground tabular-nums">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>
            –
            <span className="font-medium text-foreground tabular-nums">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground tabular-nums">
              {pagination.total}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="text-sm tabular-nums">
              Page {pagination.page} of {Math.max(pagination.pageCount, 1)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.pageCount}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </section>
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
                    {formatDate(cancellingReservation.checkInDate)} to{" "}
                    {formatDate(cancellingReservation.checkOutDate)}
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
