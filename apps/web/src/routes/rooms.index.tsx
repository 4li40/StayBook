import {
  Card,
  CardContent,
  CardHeader,
} from "@StayBook/ui/components/card";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { getErrorMessage } from "@/lib/api";
import { getDefaultRoomsSearch } from "@/lib/dates";
import { roomsQueryOptions, type RoomsSearch } from "@/lib/queries";
import RoomCard from "@/components/room-card";
import RoomsSearchForm from "@/components/rooms-search-form";

type RoomsRouteSearch = {
  checkInDate?: string;
  checkOutDate?: string;
  guests?: string;
};

function effectiveSearch(search: RoomsRouteSearch): RoomsSearch {
  const defaults = getDefaultRoomsSearch();
  return {
    checkInDate: search.checkInDate ?? defaults.checkInDate,
    checkOutDate: search.checkOutDate ?? defaults.checkOutDate,
    guests: search.guests ?? defaults.guests,
  };
}

export const Route = createFileRoute("/rooms/")({
  validateSearch: (search: Record<string, unknown>): RoomsRouteSearch => ({
    checkInDate: typeof search.checkInDate === "string" ? search.checkInDate : undefined,
    checkOutDate: typeof search.checkOutDate === "string" ? search.checkOutDate : undefined,
    guests: typeof search.guests === "string" ? search.guests : undefined,
  }),
  loaderDeps: ({ search }) => ({
    checkInDate: search.checkInDate,
    checkOutDate: search.checkOutDate,
    guests: search.guests,
  }),
  loader: ({ deps, context: { queryClient } }) =>
    queryClient.ensureQueryData({
      ...roomsQueryOptions(effectiveSearch(deps)),
      revalidateIfStale: true,
    }),
  component: RoomsComponent,
});

function RoomsComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const effective = useMemo(() => effectiveSearch(search), [search]);

  const { data, error, isPending, isFetching } = useQuery(
    roomsQueryOptions(effective),
  );
  const rooms = data?.rooms ?? [];
  const errorMessage = error ? getErrorMessage(error) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
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
            void navigate({
              to: "/rooms",
              search: {
                checkInDate: value.checkInDate,
                checkOutDate: value.checkOutDate,
                guests: value.guests,
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

      <section className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" style={{ gridAutoRows: '1fr' }} aria-live="polite">
        {isPending
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden border border-ghost-border rounded-lg">
                <Skeleton className="aspect-[4/3] w-full" />
                <CardHeader className="p-5 pb-2">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/3 mt-2" />
                </CardHeader>
                <CardContent className="px-5 py-2 flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            ))
          : null}

        {!isPending && rooms.length === 0 ? (
          <div className="rounded-lg border border-ghost-border bg-card p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
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
    </main>
  );
}
