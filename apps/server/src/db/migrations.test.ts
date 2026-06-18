import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialMigration = readFileSync(
  new URL("../../../../packages/db/src/migrations/0000_chief_bucky.sql", import.meta.url),
  "utf8",
);

describe("database migrations", () => {
  it("enforces non-overlapping confirmed reservations with a half-open GiST exclusion constraint", () => {
    expect(initialMigration).toContain('CREATE EXTENSION IF NOT EXISTS "btree_gist"');
    expect(initialMigration).toContain(
      'ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlapping_confirmed_room_dates_excl"',
    );
    expect(initialMigration).toContain("EXCLUDE USING gist");
    expect(initialMigration).toContain('"room_id" WITH =');
    expect(initialMigration).toContain(
      'daterange("check_in_date", "check_out_date", \'[)\') WITH &&',
    );
    expect(initialMigration).toContain('WHERE ("status" = \'confirmed\')');
  });

  it("keeps date order and supporting availability indexes in the migration", () => {
    expect(initialMigration).toContain("reservations_date_order_chk");
    expect(initialMigration).toContain("reservations_room_dates_status_idx");
    expect(initialMigration).toContain("reservations_guest_id_idx");
    expect(initialMigration).toContain("rooms_active_capacity_idx");
  });
});
