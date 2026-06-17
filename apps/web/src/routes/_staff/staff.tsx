import { BadgeCheck, BedDouble, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@StayBook/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { createFileRoute } from "@tanstack/react-router";

import {
  apiRequest,
  getErrorMessage,
  type StaffRoom,
  type StaffRoomsResponse,
} from "@/lib/api";

export const Route = createFileRoute("/_staff/staff")({
  component: RouteComponent,
});

const moneyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const [rooms, setRooms] = useState<StaffRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiRequest<StaffRoomsResponse>("/api/staff/rooms");
      setRooms(data.rooms);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const activeCount = rooms.filter((room) => room.active).length;
  const staffUser = session.data?.user;

  if (!staffUser) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading text-foreground tracking-tight text-balance">
            Staff Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {staffUser.name}. Review active and inactive room inventory.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadRooms} disabled={isLoading}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Total Rooms</CardDescription>
            <CardTitle className="text-3xl">{rooms.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Active Rooms</CardDescription>
            <CardTitle className="text-3xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Inactive Rooms</CardDescription>
            <CardTitle className="text-3xl">{rooms.length - activeCount}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-live="polite">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
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

        {!isLoading && rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-10 text-center">
            <BedDouble aria-hidden="true" className="size-10 text-muted-foreground" />
            <div className="flex flex-col gap-1.5">
              <h2 className="font-heading text-lg text-foreground">No Rooms Yet</h2>
              <p className="text-sm text-muted-foreground">
                Room inventory will appear here after seeding or staff creation.
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading
          ? rooms.map((room) => (
              <Card key={room.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <CardTitle>{room.name}</CardTitle>
                      <CardDescription className="capitalize">
                        {room.type} · up to {room.maxGuests} guests
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-1.5 text-sm">
                      <BadgeCheck
                        aria-hidden="true"
                        className={room.active ? "size-4 text-emerald-600" : "size-4 text-muted-foreground"}
                      />
                      <span className="font-medium">{room.active ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm md:grid-cols-[1fr_auto] md:items-end">
                  <p className="text-muted-foreground">{room.description}</p>
                  <div className="font-medium tabular-nums md:text-right">
                    {moneyFormatter.format(Number(room.nightlyPrice))} / night
                  </div>
                </CardContent>
              </Card>
            ))
          : null}
      </section>
    </main>
  );
}
