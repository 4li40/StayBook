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

const heroImage =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80";

const bentoImages = [
  {
    src: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
    alt: "Grand historic hotel exterior at twilight.",
    title: "Unforgettable Locations",
    description: "From historic European capitals to hidden tropical paradises.",
    span: "md:col-span-2 md:row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80",
    alt: "Serene spa environment with holistic wellness details.",
    title: "Wellness & Rejuvenation",
    description: "World-class spa facilities designed to restore your balance.",
    span: "md:col-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
    alt: "Crafted cocktail in a crystal glass at a sophisticated bar.",
    title: "Signature Bar",
    description: null,
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
    alt: "Artistic gourmet dish in a fine-dining setting.",
    title: "Fine Dining",
    description: null,
    span: "",
  },
];

function LandingComponent() {
  const defaultSearch = useMemo(() => getDefaultRoomsSearch(), []);
  const navigate = useNavigate();

  const { data, error, isPending, isFetching } = useQuery(
    roomsQueryOptions(defaultSearch),
  );
  const rooms = data?.rooms ?? [];
  const errorMessage = error ? getErrorMessage(error) : null;

  return (
    <main className="w-full">
      {/* Hero Section */}
      <section className="relative flex min-h-[860px] flex-col items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt="A breathtaking view of a luxury hotel suite overlooking a calm turquoise ocean at sunset."
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />
          <div className="absolute inset-0 bg-primary/20" />
        </div>

        <div className="relative z-10 w-full max-w-[1200px] px-6 text-center text-primary-foreground">
          <span className="inline-block rounded-full bg-gold-container px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-on-gold-container mb-6">
            Limited Offer: Winter Getaways
          </span>
          <h1 className="mx-auto mb-6 max-w-3xl font-heading text-4xl font-bold tracking-tight drop-shadow-lg md:text-6xl">
            A sanctuary of quiet luxury, crafted for the curious.
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-white/90">
            Experience bespoke hospitality where classic elegance meets modern precision in the world&apos;s most breathtaking destinations.
          </p>
        </div>

        {/* Prominent Search Bar */}
        <div className="relative z-20 w-full max-w-4xl px-6 -mb-24">
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
        </div>
      </section>

      {/* Featured Rooms Section */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-[1200px] px-6 pt-12">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-gold">
                Our Curated Selection
              </span>
              <h2 className="mb-4 font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Discover Unrivaled Comfort
              </h2>
              <p className="text-muted-foreground">
                Each room in our collection is a testament to refined taste and impeccable service. Explore our most sought-after signature suites.
              </p>
            </div>
            <Link
              to="/rooms"
              search={defaultSearch}
              className="hidden items-center gap-2 border-b border-foreground pb-1 text-sm font-semibold text-foreground transition-all hover:text-gold hover:border-gold md:inline-flex"
            >
              View All Accommodations
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {errorMessage ? (
            <div className="mb-8 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
            style={{ gridAutoRows: "1fr" }}
            aria-live="polite"
          >
            {isPending
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />
                ))
              : null}

            {!isPending && rooms.length === 0 ? (
              <div className="rounded-xl border border-ghost-border bg-card p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
                No rooms available right now. Check back soon.
              </div>
            ) : null}

            {!isPending
              ? rooms.slice(0, 3).map((room) => (
                  <RoomCard key={room.id} room={room} searchParams={defaultSearch} />
                ))
              : null}
          </div>

          {!isPending && rooms.length > 3 ? (
            <div className="flex justify-center pt-10">
              <Link to="/rooms" search={defaultSearch}>
                <Button
                  variant="outline"
                  className="h-11 cursor-pointer rounded-full px-8 text-sm font-semibold uppercase tracking-widest"
                >
                  Show more rooms
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* Aesthetic Bento Section */}
      <section className="bg-muted py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid h-auto grid-cols-1 gap-4 md:h-[600px] md:grid-cols-4 md:grid-rows-2">
            {bentoImages.map((item, index) => (
              <div
                key={index}
                className={`group relative overflow-hidden rounded-xl ${item.span}`}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div
                  className={`absolute inset-0 transition-all ${
                    item.description
                      ? "bg-gradient-to-t from-primary/80 to-transparent"
                      : "bg-primary/40 group-hover:bg-primary/20"
                  }`}
                />
                <div
                  className={`absolute p-6 ${
                    item.description
                      ? "bottom-0 left-0"
                      : "inset-0 flex items-center justify-center text-center"
                  }`}
                >
                  <div>
                    <h3 className="font-heading text-xl font-semibold text-white md:text-2xl">
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className="mt-1 max-w-md text-sm text-white/80">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
