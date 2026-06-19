import { Link } from "@tanstack/react-router";
import { BedDouble } from "lucide-react";

import { formatCents } from "@/lib/format";
import type { Room } from "@/lib/api";
import type { RoomsSearch } from "@/lib/queries";

type RoomCardProps = {
  room: Room;
  searchParams: RoomsSearch;
};

export default function RoomCard({ room, searchParams }: RoomCardProps) {
  return (
    <Link
      to="/rooms/$roomId"
      params={{ roomId: room.id }}
      search={searchParams}
      className="group flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      data-booked={room.booked || undefined}
    >
      <article
        className={`flex h-full flex-col overflow-hidden rounded-xl border border-ghost-border bg-card shadow-none transition-all duration-300 group-hover:border-border/60 group-hover:shadow-[0_8px_30px_rgba(26,43,60,0.04)] group-hover:-translate-y-1 ${
          room.booked ? "opacity-60" : ""
        }`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {room.primaryPhotoUrl ? (
            <img
              src={room.primaryPhotoUrl}
              alt={room.name}
              width={800}
              height={600}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/30">
              <BedDouble aria-hidden="true" className="text-muted-foreground/60 size-10" />
            </div>
          )}
          {room.booked ? (
            <span aria-label="Booked" className="absolute top-3 right-3 rounded-full bg-destructive text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-md">
              Booked
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-heading text-lg text-foreground tracking-tight line-clamp-1 group-hover:text-gold transition-colors">
              {room.name}
            </h3>
          </div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-3">
            {room.type} · up to {room.maxGuests} guests
          </p>

          <p className="line-clamp-2 text-sm text-muted-foreground/90 leading-relaxed font-sans mb-5 flex-1">
            {room.description}
          </p>

          <div className="flex items-center justify-between gap-3 mt-auto pt-4 border-t border-border/30">
            {room.booked ? (
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                Booked for these dates
              </p>
            ) : (
              <>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    From
                  </span>
                  <span className="text-lg font-bold text-foreground tabular-nums leading-tight">
                    {formatCents(room.nightlyPrice)}
                    <span className="text-xs font-normal text-muted-foreground/80">/night</span>
                  </span>
                </div>
                <span className="inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors group-hover:bg-gold/90">
                  Book Now
                </span>
              </>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
