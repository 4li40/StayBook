import { db } from "@StayBook/db";
import {
  amenities,
  roomAmenities,
  roomPhotos,
  rooms,
} from "@StayBook/db/schema";

const AMENITIES = [
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

const ROOMS = [
  {
    name: "Deluxe King Suite",
    type: "suite",
    description:
      "Spacious suite with a king bed, panoramic city views, and a separate living area.",
    maxGuests: 2,
    nightlyPrice: "299.99",
  },
  {
    name: "Standard Double",
    type: "standard",
    description:
      "Comfortable room with two double beds, perfect for friends or colleagues.",
    maxGuests: 4,
    nightlyPrice: "179.99",
  },
  {
    name: "Presidential Suite",
    type: "suite",
    description:
      "Luxurious suite with premium furnishings, private terrace, and butler service.",
    maxGuests: 2,
    nightlyPrice: "599.99",
  },
  {
    name: "Family Room",
    type: "family",
    description:
      "Large room with a queen bed and bunk beds, designed for families with children.",
    maxGuests: 5,
    nightlyPrice: "229.99",
  },
  {
    name: "Economy Single",
    type: "standard",
    description:
      "Cozy and affordable room with a single bed for the solo traveler.",
    maxGuests: 1,
    nightlyPrice: "119.99",
  },
  {
    name: "Ocean View Penthouse",
    type: "penthouse",
    description:
      "Top-floor penthouse with floor-to-ceiling windows, ocean views, and a private hot tub.",
    maxGuests: 4,
    nightlyPrice: "899.99",
  },
];

const ROOM_PHOTOS: Record<string, string[]> = {
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
};

const ROOM_AMENITY_MAP: Record<string, string[]> = {
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
};

async function seed() {
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
    .values(ROOMS)
    .onConflictDoNothing()
    .returning();

  const allRooms = await db.select().from(rooms);
  const roomIdByName = new Map(allRooms.map((r) => [r.name, r.id]));

  console.log("Seeding room photos...");
  const photoValues = Object.entries(ROOM_PHOTOS).flatMap(
    ([roomName, urls]) =>
      urls.map((url, idx) => ({
        roomId: roomIdByName.get(roomName)!,
        url,
        isPrimary: idx === 0,
        sortOrder: idx,
      })),
  );
  await db.insert(roomPhotos).values(photoValues).onConflictDoNothing();

  console.log("Seeding room amenities...");
  const roomAmenityValues = Object.entries(ROOM_AMENITY_MAP).flatMap(
    ([roomName, amenityNames]) =>
      amenityNames.map((name) => ({
        roomId: roomIdByName.get(roomName)!,
        amenityId: amenityIdByName.get(name)!,
      })),
  );
  await db
    .insert(roomAmenities)
    .values(roomAmenityValues)
    .onConflictDoNothing();

  console.log("Seed complete!");
  console.log(`  Amenities: ${allAmenities.length} (inserted ${insertedAmenities.length})`);
  console.log(`  Rooms: ${allRooms.length} (inserted ${insertedRooms.length})`);
  console.log(`  Photos: ${photoValues.length}`);
  console.log(`  Room amenities: ${roomAmenityValues.length}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
