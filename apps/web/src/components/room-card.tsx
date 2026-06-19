import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
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
      className="group flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
      data-booked={room.booked || undefined}
    >
      <Card
        className={`flex h-full flex-col overflow-hidden border border-ghost-border bg-card rounded-lg shadow-none transition-all duration-300 group-hover:border-border/60 group-hover:shadow-[0_8px_30px_rgba(26,43,60,0.04)] group-hover:-translate-y-1 ${
          room.booked ? "opacity-60" : ""
        }`}
      >
        <div className="relative overflow-hidden aspect-[4/3] bg-muted">
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
              <BedDouble aria-hidden="true" className="text-muted-foreground/60 size-8" />
            </div>
          )}
          {room.booked ? (
            <span aria-label="Booked" className="absolute top-3 right-3 rounded-full bg-destructive text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-md">
              Booked
            </span>
          ) : null}
        </div>

        <CardHeader className="p-5 pb-2">
          <CardTitle className="font-heading text-2xl text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
            {room.name}
          </CardTitle>
          <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/80 mt-1">
            {room.type} · up to {room.maxGuests} guests
          </CardDescription>
        </CardHeader>

        <CardContent className="px-5 py-2 flex flex-col gap-4">
          <p className="line-clamp-2 text-xs text-muted-foreground/90 leading-relaxed font-sans">
            {room.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {room.amenities.slice(0, 3).map((amenity) => (
              <span
                key={amenity.id}
                className="rounded-full bg-secondary text-muted-foreground/90 border border-border/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide"
              >
                {amenity.name}
              </span>
            ))}
          </div>
        </CardContent>

        <CardFooter className="mt-auto p-5 pt-3 border-t border-border/30 justify-between items-end">
          {room.booked ? (
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
              Booked for these dates
            </p>
          ) : (
            <div className="flex items-baseline gap-1.5 w-full justify-between">
              <div>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {formatCents(room.nightlyPrice)}
                </span>
                <span className="text-xs text-muted-foreground/80 font-medium font-sans"> / night</span>
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
