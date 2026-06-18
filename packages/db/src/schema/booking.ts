import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const reservationStatus = pgEnum("reservation_status", ["confirmed", "cancelled"]);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    maxGuests: integer("max_guests").notNull(),
    nightlyPrice: integer("nightly_price").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("rooms_active_capacity_idx").on(table.active, table.maxGuests),
    check("rooms_max_guests_positive_chk", sql`${table.maxGuests} > 0`),
    check("rooms_nightly_price_positive_chk", sql`${table.nightlyPrice} > 0`),
  ],
);

export const amenities = pgTable("amenities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roomPhotos = pgTable(
  "room_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("room_photos_room_id_idx").on(table.roomId),
    uniqueIndex("room_photos_one_primary_per_room_idx")
      .on(table.roomId)
      .where(sql`${table.isPrimary} = true`),
    check("room_photos_sort_order_non_negative_chk", sql`${table.sortOrder} >= 0`),
  ],
);

export const roomAmenities = pgTable(
  "room_amenities",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      name: "room_amenities_pkey",
      columns: [table.roomId, table.amenityId],
    }),
    index("room_amenities_amenity_id_idx").on(table.amenityId),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    guestId: text("guest_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    checkInDate: date("check_in_date").notNull(),
    checkOutDate: date("check_out_date").notNull(),
    totalPrice: integer("total_price").notNull(),
    status: reservationStatus("status").default("confirmed").notNull(),
    cancelledAt: timestamp("cancelled_at"),
    cancelledByUserId: text("cancelled_by_user_id").references(() => user.id, { onDelete: "set null" }),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("reservations_room_dates_status_idx").on(
      table.roomId,
      table.checkInDate,
      table.checkOutDate,
      table.status,
    ),
    index("reservations_guest_id_idx").on(table.guestId),
    index("reservations_status_idx").on(table.status),
    index("reservations_check_in_date_idx").on(table.checkInDate),
    index("reservations_check_out_date_idx").on(table.checkOutDate),
    check("reservations_date_order_chk", sql`${table.checkOutDate} > ${table.checkInDate}`),
    check("reservations_total_price_non_negative_chk", sql`${table.totalPrice} >= 0`),
  ],
);

export const roomsRelations = relations(rooms, ({ many }) => ({
  photos: many(roomPhotos),
  roomAmenities: many(roomAmenities),
  reservations: many(reservations),
}));

export const amenitiesRelations = relations(amenities, ({ many }) => ({
  roomAmenities: many(roomAmenities),
}));

export const roomPhotosRelations = relations(roomPhotos, ({ one }) => ({
  room: one(rooms, {
    fields: [roomPhotos.roomId],
    references: [rooms.id],
  }),
}));

export const roomAmenitiesRelations = relations(roomAmenities, ({ one }) => ({
  room: one(rooms, {
    fields: [roomAmenities.roomId],
    references: [rooms.id],
  }),
  amenity: one(amenities, {
    fields: [roomAmenities.amenityId],
    references: [amenities.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  room: one(rooms, {
    fields: [reservations.roomId],
    references: [rooms.id],
  }),
  guest: one(user, {
    fields: [reservations.guestId],
    references: [user.id],
  }),
  cancelledBy: one(user, {
    fields: [reservations.cancelledByUserId],
    references: [user.id],
  }),
}));
