import { pathToFileURL } from "node:url";

import { auth } from "@StayBook/auth";
import { db } from "@StayBook/db";
import {
  amenities,
  roomAmenities,
  roomPhotos,
  reservations,
  rooms,
  user,
} from "@StayBook/db/schema";
import { env } from "@StayBook/env/server";
import { eq, inArray, or, sql } from "drizzle-orm";

export type SeedUser = {
  name: string;
  email: string;
  password: string;
  role: "guest" | "staff";
};

export type SeedReservation = {
  label: string;
  roomName: string;
  guestEmail: string;
  checkInOffsetDays: number;
  checkOutOffsetDays: number;
  status: "confirmed" | "cancelled";
  cancellationReason?: string;
  cancelledByEmail?: string;
};

export const AMENITIES = [
  "Wi-Fi",
  "Air Conditioning",
  "Heating",
  "TV",
  "Mini Bar",
  "Safe",
  "Coffee Maker",
  "Hair Dryer",
  "Iron",
  "Balcony",
  "Bathtub",
  "Shower",
];

export const ROOMS = [
  {
    name: "Deluxe King Suite",
    type: "suite",
    description:
      "Spacious suite with a king bed, panoramic city views, and a separate living area.",
    maxGuests: 2,
    nightlyPrice: 29999,
  },
  {
    name: "Standard Double",
    type: "standard",
    description:
      "Comfortable room with two double beds, perfect for friends or colleagues.",
    maxGuests: 4,
    nightlyPrice: 17999,
  },
  {
    name: "Presidential Suite",
    type: "suite",
    description:
      "Luxurious suite with premium furnishings, private terrace, and butler service.",
    maxGuests: 2,
    nightlyPrice: 59999,
  },
  {
    name: "Family Room",
    type: "family",
    description:
      "Large room with a queen bed and bunk beds, designed for families with children.",
    maxGuests: 5,
    nightlyPrice: 22999,
  },
  {
    name: "Economy Single",
    type: "standard",
    description:
      "Cozy and affordable room with a single bed for the solo traveler.",
    maxGuests: 1,
    nightlyPrice: 11999,
  },
  {
    name: "Ocean View Penthouse",
    type: "penthouse",
    description:
      "Top-floor penthouse with floor-to-ceiling windows, ocean views, and a private hot tub.",
    maxGuests: 4,
    nightlyPrice: 89999,
  },
  {
    name: "Garden Courtyard Queen",
    type: "standard",
    description:
      "Quiet queen room opening toward the courtyard, with a writing desk and leafy views.",
    maxGuests: 2,
    nightlyPrice: 15999,
  },
  {
    name: "Accessible Queen Studio",
    type: "studio",
    description:
      "Step-free studio with a queen bed, roll-in shower, and generous turning space.",
    maxGuests: 2,
    nightlyPrice: 14999,
  },
  {
    name: "Business Loft",
    type: "loft",
    description:
      "Split-level loft with a dedicated workspace, sofa bed, and fast Wi-Fi for longer stays.",
    maxGuests: 3,
    nightlyPrice: 24999,
  },
  {
    name: "Turnover Studio",
    type: "studio",
    description:
      "Compact studio reserved for demonstrating same-day checkout and check-in availability.",
    maxGuests: 2,
    nightlyPrice: 13999,
  },
  {
    name: "Overlap Demo Queen",
    type: "standard",
    description:
      "Predictable demo room with seeded reservations for availability overlap testing.",
    maxGuests: 2,
    nightlyPrice: 12999,
  },
];

export const ROOM_PHOTOS: Record<string, string[]> = {
  "Deluxe King Suite": [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
  ],
  "Standard Double": [
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800",
  ],
  "Presidential Suite": [
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
  ],
  "Family Room": [
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800",
  ],
  "Economy Single": [
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800",
  ],
  "Ocean View Penthouse": [
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800",
  ],
  "Garden Courtyard Queen": [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
  ],
  "Accessible Queen Studio": [
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
  ],
  "Business Loft": [
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800",
  ],
  "Turnover Studio": [
    "https://images.unsplash.com/photo-1598928636135-d146006ff4be?w=800",
  ],
  "Overlap Demo Queen": [
    "https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=800",
  ],
};

export const ROOM_AMENITY_MAP: Record<string, string[]> = {
  "Deluxe King Suite": [
    "Wi-Fi",
    "Air Conditioning",
    "TV",
    "Mini Bar",
    "Safe",
    "Bathtub",
  ],
  "Standard Double": ["Wi-Fi", "Heating", "TV", "Coffee Maker"],
  "Presidential Suite": [
    "Wi-Fi",
    "Air Conditioning",
    "TV",
    "Mini Bar",
    "Safe",
    "Coffee Maker",
    "Hair Dryer",
    "Balcony",
    "Bathtub",
  ],
  "Family Room": [
    "Wi-Fi",
    "Air Conditioning",
    "TV",
    "Coffee Maker",
    "Iron",
    "Shower",
  ],
  "Economy Single": ["Wi-Fi", "Shower"],
  "Ocean View Penthouse": [
    "Wi-Fi",
    "Air Conditioning",
    "Heating",
    "TV",
    "Mini Bar",
    "Safe",
    "Coffee Maker",
    "Hair Dryer",
    "Iron",
    "Balcony",
    "Bathtub",
  ],
  "Garden Courtyard Queen": ["Wi-Fi", "Heating", "TV", "Coffee Maker", "Hair Dryer"],
  "Accessible Queen Studio": ["Wi-Fi", "Air Conditioning", "Shower", "Safe"],
  "Business Loft": [
    "Wi-Fi",
    "Air Conditioning",
    "TV",
    "Coffee Maker",
    "Iron",
    "Safe",
  ],
  "Turnover Studio": ["Wi-Fi", "Air Conditioning", "TV", "Shower"],
  "Overlap Demo Queen": ["Wi-Fi", "Heating", "TV", "Coffee Maker"],
};

export const STAFF_USER: SeedUser = {
  name: "StayBook Staff",
  email: "staff@staybook.test",
  password: "StayBook123!",
  role: "staff",
};

export const GUEST_USERS: SeedUser[] = [
  {
    name: "Alex Guest",
    email: "guest.alex@staybook.test",
    password: "StayBook123!",
    role: "guest",
  },
  {
    name: "Mina Guest",
    email: "guest.mina@staybook.test",
    password: "StayBook123!",
    role: "guest",
  },
  {
    name: "Sam Guest",
    email: "guest.sam@staybook.test",
    password: "StayBook123!",
    role: "guest",
  },
];

export const SEED_RESERVATIONS: SeedReservation[] = [
  {
    label: "active stay",
    roomName: "Deluxe King Suite",
    guestEmail: "guest.alex@staybook.test",
    checkInOffsetDays: -1,
    checkOutOffsetDays: 2,
    status: "confirmed",
  },
  {
    label: "upcoming stay",
    roomName: "Standard Double",
    guestEmail: "guest.mina@staybook.test",
    checkInOffsetDays: 7,
    checkOutOffsetDays: 10,
    status: "confirmed",
  },
  {
    label: "past stay",
    roomName: "Economy Single",
    guestEmail: "guest.sam@staybook.test",
    checkInOffsetDays: -20,
    checkOutOffsetDays: -17,
    status: "confirmed",
  },
  {
    label: "cancelled stay",
    roomName: "Family Room",
    guestEmail: "guest.alex@staybook.test",
    checkInOffsetDays: 4,
    checkOutOffsetDays: 6,
    status: "cancelled",
    cancelledByEmail: "staff@staybook.test",
    cancellationReason: "Seeded manual cancellation for reviewer workflows.",
  },
  {
    label: "overlap blocking stay",
    roomName: "Overlap Demo Queen",
    guestEmail: "guest.mina@staybook.test",
    checkInOffsetDays: 14,
    checkOutOffsetDays: 17,
    status: "confirmed",
  },
  {
    label: "cancelled overlapping stay",
    roomName: "Overlap Demo Queen",
    guestEmail: "guest.sam@staybook.test",
    checkInOffsetDays: 15,
    checkOutOffsetDays: 16,
    status: "cancelled",
    cancelledByEmail: "staff@staybook.test",
    cancellationReason:
      "Cancelled overlap should not block availability searches.",
  },
  {
    label: "turnover checkout",
    roomName: "Turnover Studio",
    guestEmail: "guest.alex@staybook.test",
    checkInOffsetDays: 20,
    checkOutOffsetDays: 22,
    status: "confirmed",
  },
  {
    label: "turnover check-in",
    roomName: "Turnover Studio",
    guestEmail: "guest.mina@staybook.test",
    checkInOffsetDays: 22,
    checkOutOffsetDays: 24,
    status: "confirmed",
  },
];

export function dateFromTodayOffset(offsetDays: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function differenceInNights(checkInDate: string, checkOutDate: string) {
  const checkIn = Date.parse(`${checkInDate}T00:00:00.000Z`);
  const checkOut = Date.parse(`${checkOutDate}T00:00:00.000Z`);
  return Math.round((checkOut - checkIn) / (24 * 60 * 60 * 1000));
}

export function getRequiredMapValue<K, V>(map: Map<K, V>, key: K, label: string): V {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing seeded ${label}: ${String(key)}`);
  }

  return value;
}

async function seedUser(seedUser: SeedUser) {
  const normalizedEmail = seedUser.email.toLowerCase();
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, normalizedEmail),
  });

  if (!existingUser) {
    await auth.api.signUpEmail({
      body: {
        name: seedUser.name,
        email: normalizedEmail,
        password: seedUser.password,
      },
      headers: new Headers({
        origin: env.CORS_ORIGIN,
        host: new URL(env.BETTER_AUTH_URL).host,
      }),
    });
  }

  await db
    .update(user)
    .set({
      name: seedUser.name,
      role: seedUser.role,
      emailVerified: true,
    })
    .where(eq(user.email, normalizedEmail));
}

async function seedUsers() {
  for (const seedUserData of [STAFF_USER, ...GUEST_USERS]) {
    await seedUser(seedUserData);
  }
}

export async function seed() {
  console.log("Seeding deterministic users...");
  await seedUsers();

  console.log("Seeding amenities...");
  const insertedAmenities = await db
    .insert(amenities)
    .values(AMENITIES.map((name) => ({ name })))
    .onConflictDoNothing()
    .returning();

  const allAmenities = await db.select().from(amenities);
  const amenityIdByName = new Map(allAmenities.map((a) => [a.name, a.id]));

  console.log("Seeding rooms...");
  const insertedRooms = await db
    .insert(rooms)
    .values(ROOMS.map((room) => ({ ...room, active: true })))
    .onConflictDoUpdate({
      target: rooms.name,
      set: {
        type: sql`excluded.type`,
        description: sql`excluded.description`,
        maxGuests: sql`excluded.max_guests`,
        nightlyPrice: sql`excluded.nightly_price`,
        active: sql`excluded.active`,
        updatedAt: new Date(),
      },
    })
    .returning();

  const seededRoomNames = ROOMS.map((room) => room.name);
  const allRooms = await db
    .select()
    .from(rooms)
    .where(inArray(rooms.name, seededRoomNames));
  const roomIdByName = new Map(allRooms.map((r) => [r.name, r.id]));
  const roomByName = new Map(allRooms.map((r) => [r.name, r]));
  const seededRoomIds = ROOMS.map((room) =>
    getRequiredMapValue(roomIdByName, room.name, "room"),
  );

  console.log("Resetting seeded room photos and amenities...");
  await db.delete(roomPhotos).where(inArray(roomPhotos.roomId, seededRoomIds));
  await db
    .delete(roomAmenities)
    .where(inArray(roomAmenities.roomId, seededRoomIds));

  console.log("Seeding room photos...");
  const photoValues = Object.entries(ROOM_PHOTOS).flatMap(
    ([roomName, urls]) =>
      urls.map((url, idx) => ({
        roomId: getRequiredMapValue(roomIdByName, roomName, "room"),
        url,
        altText: `${roomName} photo ${idx + 1}`,
        isPrimary: idx === 0,
        sortOrder: idx,
      })),
  );
  await db.insert(roomPhotos).values(photoValues);

  console.log("Seeding room amenities...");
  const roomAmenityValues = Object.entries(ROOM_AMENITY_MAP).flatMap(
    ([roomName, amenityNames]) =>
      amenityNames.map((name) => ({
        roomId: getRequiredMapValue(roomIdByName, roomName, "room"),
        amenityId: getRequiredMapValue(amenityIdByName, name, "amenity"),
      })),
  );
  await db.insert(roomAmenities).values(roomAmenityValues);

  const seededUsers = await db
    .select()
    .from(user)
    .where(
      inArray(
        user.email,
        [STAFF_USER, ...GUEST_USERS].map((seedUserData) =>
          seedUserData.email.toLowerCase(),
        ),
      ),
    );
  const userIdByEmail = new Map(
    seededUsers.map((seedUserData) => [seedUserData.email, seedUserData.id]),
  );
  const seededGuestIds = GUEST_USERS.map((guestUser) =>
    getRequiredMapValue(userIdByEmail, guestUser.email.toLowerCase(), "guest"),
  );

  console.log("Resetting seeded room and guest reservations...");
  await db
    .delete(reservations)
    .where(
      or(
        inArray(reservations.guestId, seededGuestIds),
        inArray(reservations.roomId, seededRoomIds),
      ),
    );

  console.log("Seeding reservations...");
  const reservationValues = SEED_RESERVATIONS.map((reservation) => {
    const room = getRequiredMapValue(roomByName, reservation.roomName, "room");
    const checkInDate = dateFromTodayOffset(reservation.checkInOffsetDays);
    const checkOutDate = dateFromTodayOffset(reservation.checkOutOffsetDays);
    const nights = differenceInNights(checkInDate, checkOutDate);
    const cancelledByUserId = reservation.cancelledByEmail
      ? getRequiredMapValue(
          userIdByEmail,
          reservation.cancelledByEmail.toLowerCase(),
          "cancelling user",
        )
      : null;

    return {
      roomId: room.id,
      guestId: getRequiredMapValue(
        userIdByEmail,
        reservation.guestEmail.toLowerCase(),
        "guest",
      ),
      checkInDate,
      checkOutDate,
      totalPrice: room.nightlyPrice * nights,
      status: reservation.status,
      cancelledAt: reservation.status === "cancelled" ? new Date() : null,
      cancelledByUserId,
      cancellationReason: reservation.cancellationReason ?? null,
    };
  });
  const insertedReservations = await db
    .insert(reservations)
    .values(reservationValues)
    .returning();

  console.log("Verifying seed data...");
  const seededReservations = await db
    .select()
    .from(reservations)
    .where(inArray(reservations.guestId, seededGuestIds));
  const activeRoomCount = allRooms.filter((room) => room.active).length;
  const confirmedReservationCount = seededReservations.filter(
    (reservation) => reservation.status === "confirmed",
  ).length;
  const cancelledReservationCount = seededReservations.filter(
    (reservation) => reservation.status === "cancelled",
  ).length;
  const hasActiveReservation = seededReservations.some(
    (reservation) =>
      reservation.status === "confirmed" &&
      reservation.checkInDate <= dateFromTodayOffset(0) &&
      reservation.checkOutDate > dateFromTodayOffset(0),
  );
  const hasPastReservation = seededReservations.some(
    (reservation) =>
      reservation.status === "confirmed" &&
      reservation.checkOutDate <= dateFromTodayOffset(0),
  );
  const hasUpcomingReservation = seededReservations.some(
    (reservation) =>
      reservation.status === "confirmed" &&
      reservation.checkInDate > dateFromTodayOffset(0),
  );

  if (
    activeRoomCount < 10 ||
    seededGuestIds.length < 3 ||
    !hasActiveReservation ||
    !hasUpcomingReservation ||
    !hasPastReservation ||
    cancelledReservationCount < 1 ||
    confirmedReservationCount < 1
  ) {
    throw new Error(
      "Seed verification failed: expected users, active rooms, and reservation states were not created.",
    );
  }

  console.log("Seed complete!");
  console.log(`  Staff: ${STAFF_USER.email} / ${STAFF_USER.password}`);
  console.log("  Guests:");
  for (const guest of GUEST_USERS) {
    console.log(`    ${guest.email} / ${guest.password}`);
  }
  console.log(`  Amenities: ${allAmenities.length} (inserted ${insertedAmenities.length})`);
  console.log(`  Active seeded rooms: ${activeRoomCount} (upserted ${insertedRooms.length})`);
  console.log(`  Photos: ${photoValues.length}`);
  console.log(`  Room amenities: ${roomAmenityValues.length}`);
  console.log(`  Reservations: ${seededReservations.length} (inserted ${insertedReservations.length})`);
  console.log("  Availability demos:");
  for (const reservation of SEED_RESERVATIONS) {
    console.log(
      `    ${reservation.label}: ${reservation.roomName}, ${dateFromTodayOffset(
        reservation.checkInOffsetDays,
      )} to ${dateFromTodayOffset(reservation.checkOutOffsetDays)} (${reservation.status})`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
