import {
  Card,
  CardContent,
  CardHeader,
} from "@StayBook/ui/components/card";
import { Button } from "@StayBook/ui/components/button";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import { getErrorMessage } from "@/lib/api";
import { getDefaultRoomsListParams, roomsQueryOptions, type RoomsListParams } from "@/lib/queries";
import RoomCard from "@/components/room-card";
import RoomFilters, {
  countActiveFilters,
  defaultRoomFilters,
  type RoomFiltersState,
} from "@/components/room-filters";
import RoomsSearchForm from "@/components/rooms-search-form";
import { PaginationControls } from "@/components/pagination-controls";

type RoomsRouteSearch = {
  checkInDate?: string;
  checkOutDate?: string;
  guests?: string;
  page?: number;
};

function parsePage(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function effectiveSearch(search: RoomsRouteSearch, filters: RoomFiltersState): RoomsListParams {
  const defaults = getDefaultRoomsListParams();
  return {
    checkInDate: search.checkInDate ?? defaults.checkInDate,
    checkOutDate: search.checkOutDate ?? defaults.checkOutDate,
    guests: search.guests ?? defaults.guests,
    page: parsePage(search.page),
    pageSize: defaults.pageSize,
    filters,
  };
}

export const Route = createFileRoute("/rooms/")({
  validateSearch: (search: Record<string, unknown>): RoomsRouteSearch => ({
    checkInDate: typeof search.checkInDate === "string" ? search.checkInDate : undefined,
    checkOutDate: typeof search.checkOutDate === "string" ? search.checkOutDate : undefined,
    guests: typeof search.guests === "string" ? search.guests : undefined,
    page: parsePage(search.page),
  }),
  loaderDeps: ({ search }) => ({
    checkInDate: search.checkInDate,
    checkOutDate: search.checkOutDate,
    guests: search.guests,
    page: search.page,
  }),
  loader: ({ deps, context: { queryClient } }) =>
    queryClient.ensureQueryData({
      ...roomsQueryOptions(effectiveSearch(deps, defaultRoomFilters)),
      revalidateIfStale: true,
    }),
  component: RoomsComponent,
});

function RoomsComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<RoomFiltersState>(defaultRoomFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const effective = useMemo(() => effectiveSearch(search, filters), [search, filters]);

  const { data, error, isPending, isFetching } = useQuery(
    roomsQueryOptions(effective),
  );
  const rooms = data?.rooms ?? [];
  const pagination = data?.pagination;
  const options = data?.options;
  const errorMessage = error ? getErrorMessage(error) : null;
  const activeFilterCount = countActiveFilters(filters);
  const hasRooms = !isPending && rooms.length > 0;

  function navigateToSearch(nextSearch: Partial<RoomsRouteSearch>) {
    void navigate({
      to: "/rooms",
      search: {
        checkInDate: effective.checkInDate,
        checkOutDate: effective.checkOutDate,
        guests: effective.guests,
        page: effective.page,
        ...nextSearch,
      },
    });
  }

  function resetFiltersOnSearchChange() {
    if (activeFilterCount > 0) {
      setFilters(defaultRoomFilters);
    }
    navigateToSearch({ page: 1 });
  }

  function handleFiltersChange(next: RoomFiltersState) {
    setFilters(next);
    navigateToSearch({ page: 1 });
  }

  function handlePageChange(nextPage: number) {
    navigateToSearch({ page: nextPage });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const filtersPanel = hasRooms && options ? (
    <RoomFilters
      options={options}
      filters={filters}
      onChange={handleFiltersChange}
      resultCount={pagination?.total ?? rooms.length}
      totalCount={pagination?.total ?? rooms.length}
    />
  ) : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12">
      <section className="flex flex-col items-center text-center gap-8 py-4">
        <div className="flex flex-col gap-3 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-heading text-foreground tracking-tight text-balance">
            Find your stay
          </h1>
          <p className="text-base text-muted-foreground/90 leading-relaxed font-sans max-w-lg mx-auto">
            Browse our full collection of architectural retreats and boutique rooms.
          </p>
        </div>

        <RoomsSearchForm
          defaultValues={effective}
          onSubmit={(value) => {
            resetFiltersOnSearchChange();
            void navigate({
              to: "/rooms",
              search: {
                checkInDate: value.checkInDate,
                checkOutDate: value.checkOutDate,
                guests: value.guests,
                page: 1,
              },
            });
          }}
          submitDisabled={isPending || isFetching}
        />
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          {hasRooms ? filtersPanel : isPending ? <FilterSkeleton /> : null}
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          {/* Mobile filter toggle */}
          {hasRooms ? (
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{pagination?.total ?? rooms.length}</span> rooms
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMobileFiltersOpen((open) => !open)}
                className="gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </div>
          ) : null}

          {/* Mobile filter panel (collapsible) */}
          {hasRooms && mobileFiltersOpen ? (
            <div className="lg:hidden">
              {filtersPanel}
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Close filters
                </Button>
              </div>
            </div>
          ) : null}

          <section
            className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
            style={{ gridAutoRows: '1fr' }}
            aria-live="polite"
          >
            {isPending
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden border border-ghost-border rounded-xl">
                    <Skeleton className="aspect-[4/3] w-full" />
                    <CardHeader className="p-5 pb-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-3 w-1/3 mt-2" />
                    </CardHeader>
                    <CardContent className="px-5 py-2 flex flex-col gap-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                    </CardContent>
                  </Card>
                ))
              : null}

            {!isPending && rooms.length === 0 ? (
              <div className="rounded-lg border border-ghost-border bg-card p-12 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                No rooms match this search. Try fewer guests or a different date range.
              </div>
            ) : null}

            {!isPending
              ? rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    searchParams={effective}
                  />
                ))
              : null}
          </section>

          {!isPending && pagination && pagination.pageCount > 1 ? (
            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              pageCount={pagination.pageCount}
              onPageChange={handlePageChange}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function FilterSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="flex flex-col gap-6 rounded-xl border border-ghost-border bg-card p-5"
    >
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-px w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </aside>
  );
}
