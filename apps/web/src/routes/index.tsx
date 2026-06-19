import { Button } from "@StayBook/ui/components/button";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { getErrorMessage } from "@/lib/api";
import { getDefaultRoomsSearch } from "@/lib/dates";
import { roomsQueryOptions } from "@/lib/queries";
import RoomCard from "@/components/room-card";
import RoomsSearchForm from "@/components/rooms-search-form";

export const Route = createFileRoute("/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      ...roomsQueryOptions(getDefaultRoomsSearch()),
      revalidateIfStale: true,
    }),
  component: LandingComponent,
});

function LandingComponent() {
  const defaultSearch = useMemo(() => getDefaultRoomsSearch(), []);
  const navigate = useNavigate();

  const { data, error, isPending, isFetching } = useQuery(
    roomsQueryOptions(defaultSearch),
  );
  const rooms = data?.rooms ?? [];
  const errorMessage = error ? getErrorMessage(error) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <section className="flex flex-col items-center text-center gap-8 py-4">
        <div className="flex flex-col gap-3 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-heading text-foreground tracking-tight text-balance">
            Curated Spaces for the Thoughtful Traveler
          </h1>
          <p className="text-base text-muted-foreground/90 leading-relaxed font-sans max-w-lg mx-auto">
            StayBook connects you with handpicked architectural retreats and luxury boutique stays.
          </p>
        </div>

        <RoomsSearchForm
          defaultValues={defaultSearch}
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

      <section className="flex flex-col gap-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-heading text-foreground tracking-tight">
            Featured stays
          </h2>
          <Link
            to="/rooms"
            search={defaultSearch}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-primary hover:opacity-90 transition-opacity"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" style={{ gridAutoRows: '1fr' }} aria-live="polite">
          {isPending
            ? Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/3] w-full rounded-lg" />
              ))
            : null}

          {!isPending && rooms.length === 0 ? (
            <div className="rounded-lg border border-ghost-border bg-card p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
              No rooms available right now. Check back soon.
            </div>
          ) : null}

          {!isPending
            ? rooms.slice(0, 3).map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  searchParams={defaultSearch}
                />
              ))
            : null}
        </div>

        {!isPending && rooms.length > 3 ? (
          <div className="flex justify-center pt-2">
            <Link to="/rooms" search={defaultSearch}>
              <Button variant="outline" className="cursor-pointer h-11 px-8 text-sm font-semibold uppercase tracking-[0.08em] rounded-full">
                Show more rooms
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
