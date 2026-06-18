# StayBook PRD Implementation Tracker

Last audited: 2026-06-17

Source of truth: `docs/PRD.md`

Verification snapshot:

- `npm run test` passes: 4 server test files, 32 tests.
- `npm run check-types` passes.

## Done

### Project Foundation

- [x] Monorepo split exists for `apps/web`, `apps/server`, `packages/db`, `packages/auth`, `packages/env`, and `packages/ui`.
- [x] React web app uses TanStack Router.
- [x] Express API app is wired under `/api`.
- [x] Shared UI primitives exist for button, card, input, label, checkbox, dropdown, skeleton, and notifications.
- [x] Turborepo scripts exist for dev, build, type checking, tests, database migration, and seeding.

### Authentication

- [x] Better Auth email/password authentication is configured.
- [x] Users have a `role` field with `guest` and `staff` values.
- [x] Public registration defaults users to the `guest` role because role input is disabled.
- [x] Sessions use Better Auth cookies with `httpOnly`, `secure`, and `sameSite: "none"`.
- [x] Guest-only reservation API is protected by `requireSession` and `requireGuest`.
- [x] Login and sign-up forms include client-side validation and show field-level errors.

### Database And Migrations

- [x] Booking schema includes rooms, room photos, amenities, room amenity links, and reservations.
- [x] Rooms include name, type, description, max guest count, nightly price, active flag, created timestamp, and updated timestamp.
- [x] Reservations include room, guest, check-in date, check-out date, total price, status, cancellation metadata, created timestamp, and updated timestamp.
- [x] Reservation statuses include `confirmed` and `cancelled`.
- [x] Date order check prevents check-out dates that are not after check-in dates.
- [x] Confirmed reservation overlap is blocked by a PostgreSQL GiST exclusion constraint using half-open `daterange(check_in_date, check_out_date, '[)')`.
- [x] Migration enables `btree_gist`.
- [x] Supporting indexes exist for room active/capacity, reservation room/date/status, reservation guest, reservation status, check-in date, and check-out date.
- [x] Cancelled reservations do not block availability because overlap queries and the exclusion constraint only consider `status = 'confirmed'`.

### Guest Room Search And Room Details

- [x] Guest room search accepts check-in date, check-out date, and guest count.
- [x] Server validates date format, real calendar dates, check-out after check-in, and guest count range.
- [x] Room search hides inactive rooms.
- [x] Room search filters out rooms below the requested guest count.
- [x] Room search excludes rooms with overlapping confirmed reservations.
- [x] Same-day turnover is supported by half-open range overlap checks.
- [x] Room cards show type, price, capacity, amenities, and a representative image when available.
- [x] Placeholder room image/icon appears when no real photo is available.
- [x] Room detail page shows photos, description, amenities, occupancy, and nightly price.
- [x] Room detail page has loading and error states.
- [x] Room search page has loading, empty, and error states.

### Guest Booking And Reservations

- [x] Authenticated guests can create reservations from the room detail page.
- [x] Booking request validates room id, check-in date, check-out date, and guest count.
- [x] Server recalculates total price from the stored room nightly price.
- [x] Booking insert verifies room is active and has enough capacity.
- [x] Booking relies on the database exclusion constraint to reject concurrent overlap conflicts.
- [x] Overlap constraint violations return a clear `409 CONFLICT` response.
- [x] Room detail page previews number of nights and total price before booking.
- [x] Booking success shows a success toast.
- [x] Guest reservation history endpoint returns reservations with room summary data.
- [x] Guest reservation list endpoint returns pagination metadata.
- [x] Guest dashboard lists reservations and their status.
- [x] Cancelled reservations are labeled through the visible reservation status.
- [x] Guests can cancel their own confirmed reservations.
- [x] Guest cancellation preserves the reservation record and stores cancellation metadata.
- [x] Server prevents guest cancellation within 24 hours of check-in.

### API Response And Validation Basics

- [x] API responses use consistent success envelopes through `{ data }`.
- [x] API errors use consistent `{ error: { code, message } }` envelopes.
- [x] Zod validation errors include issue paths and messages.
- [x] API payloads and query parameters are validated at route boundaries for implemented endpoints.
- [x] SQL queries use Drizzle `sql` template parameters instead of raw string concatenation with user input.

### Seed And Documentation

- [x] Seed script creates amenities.
- [x] Seed script creates rooms with varied types, capacities, prices, amenities, and photos.
- [x] README documents basic install, migration, and run commands.
- [x] README documents available project scripts.

## Partially Done / Needs Tightening

- [x] Change money storage to match the PRD: schema currently stores `numeric(10, 2)` dollar amounts, while the PRD asks for prices in cents.
- [x] Wrap booking creation in an explicit transaction. Current implementation uses one `insert ... select` plus the database constraint, but the PRD specifically asks for a transaction.
- [x] Centralize reservation overlap and booking business logic in domain services. It currently lives directly inside route handlers.
- [x] Make room detail access respect guest availability expectations. `/api/rooms/:roomId` currently returns inactive rooms too.
- [x] Preserve selected search dates and guest count when moving from room search to room detail/booking.
- [x] Add a dedicated booking confirmation view or flow if the PRD's "booking confirmation" route is meant to be more than a toast.
- [x] Split guest reservations into upcoming and past views instead of showing one combined list.
- [x] Derive and display operational reservation states: upcoming, active, past, and cancelled.
- [x] Improve cancelled reservation display with a clearer visual label/badge, not just status text.
- [x] Hide or disable guest cancellation proactively when the 24-hour cutoff has passed, while keeping server enforcement.
- [x] Add field-level validation errors to room search and booking forms instead of only showing top-level API/toast errors.
- [x] Preserve user-entered values in room and reservation forms when server validation fails.
- [x] Add pagination UI for guest reservations. The API has metadata, but the dashboard fetches `pageSize=50` and does not expose pagination controls.
- [x] Document seed command and seeded credentials in README once deterministic users exist.
- [x] Add sample environment documentation for required secrets and database URLs.
- [x] Fix `npm run check-types` failure in `apps/server/src/api/dates.test.ts`.

## Still To Implement

### Staff Authentication And Authorization

- [x] Add `requireStaff` middleware.
- [x] Add staff-only API route group.
- [x] Ensure guests receive `403 FORBIDDEN` from every staff API.
- [x] Ensure unauthenticated users receive `401 UNAUTHORIZED` from staff APIs.
- [x] Decide whether staff may use guest booking APIs; if not, test and enforce rejection.
- [x] Add staff-aware navigation and protected staff pages in the web app.
- [x] Prevent guests from accessing staff pages.

### Staff Room Inventory Management

- [x] Staff API: list all rooms, including inactive rooms.
- [x] Staff API: create rooms with type, description, capacity, price, amenities, and photos.
- [x] Staff API: validate required room fields and numeric ranges.
- [x] Staff API: edit room details, capacity, price, amenities, and photos.
- [x] Staff API: deactivate rooms without deleting history.
- [x] Staff API: restore/reactivate rooms if staff tools should support auditing and recovery.
- [x] Staff UI: room inventory table/list.
- [x] Staff UI: add room form.
- [x] Staff UI: edit room form.
- [x] Staff UI: deactivate/reactivate controls.
- [x] Staff UI: loading, empty, error, validation, and success states for inventory workflows.

### Staff Reservation Management

- [x] Staff API: list all reservations.
- [x] Staff API: filter reservations by date range.
- [x] Staff API: filter reservations by room.
- [x] Staff API: filter reservations by status or derived state.
- [x] Staff API: paginate reservation lists with metadata.
- [x] Staff API: manually cancel any reservation.
- [x] Staff API: preserve reservation records and cancellation metadata for manual cancellations.
- [x] Staff UI: reservation management page.
- [x] Staff UI: date range, room, and status filters.
- [x] Staff UI: pagination controls.
- [x] Staff UI: manual cancellation flow.
- [x] Staff UI: loading, empty, error, validation, and success states for reservation workflows.

### Seeder

- [ ] Seed at least 10 active rooms. Current seed has 6.
- [x] Seed at least one staff account.
- [ ] Seed multiple guest accounts.
- [ ] Seed upcoming reservations.
- [ ] Seed active reservations.
- [ ] Seed past reservations.
- [ ] Seed cancelled reservations.
- [ ] Seed deterministic credentials for reviewers.
- [ ] Seed predictable overlap edge cases to demonstrate availability behavior.
- [ ] Add seed verification that confirms seeded users, rooms, and reservations exist.

### Rate Limiting And Security Hardening

- [ ] Add rate limiting to authentication endpoints.
- [ ] Make login and registration limits stricter than ordinary read endpoints.
- [ ] Add ordinary read endpoint rate limits if desired by the PRD interpretation.
- [ ] Review CORS/cookie settings for local development and production deployment.

### Testing

- [ ] API tests for unauthenticated access.
- [x] API tests for guest/staff role boundaries.
- [ ] API tests for room availability search.
- [ ] Availability edge case tests: overlapping start.
- [ ] Availability edge case tests: overlapping end.
- [ ] Availability edge case tests: fully contained range.
- [ ] Availability edge case tests: requested range containing existing reservation.
- [ ] Availability edge case tests: same-day checkout/check-in allowed.
- [ ] Availability edge case tests: inactive rooms excluded.
- [ ] Availability edge case tests: insufficient capacity excluded.
- [ ] Availability edge case tests: cancelled reservations do not block.
- [ ] API tests for booking creation success.
- [ ] API tests for booking conflicts.
- [ ] Concurrent booking test: one confirmed reservation and one conflict response.
- [ ] Database-level or migration verification test for the overlap exclusion constraint.
- [ ] API tests for guest cancellation more than 24 hours before check-in.
- [ ] API tests for cancellation exactly at the 24-hour cutoff.
- [ ] API tests for cancellation inside the 24-hour cutoff.
- [ ] API tests for malformed dates.
- [ ] API tests for invalid guest counts.
- [ ] API tests for invalid pagination values.
- [ ] API tests for unexpected fields.
- [ ] API tests for invalid room prices.
- [ ] API tests for missing required fields.
- [ ] API tests for pagination response metadata.
- [ ] API tests for staff room management.
- [ ] API tests for staff reservation filtering.
- [ ] Frontend tests for auth form validation messaging.
- [ ] Frontend tests for room search loading, empty, and error states.
- [ ] Frontend tests for successful booking confirmation.
- [ ] Frontend tests for role-specific navigation.

### Documentation

- [ ] Expand README with full reviewer setup: install, environment, migrate, seed, run.
- [ ] Document required environment variables with safe sample values.
- [ ] Document local database setup expectations.
- [ ] Document seeded guest credentials.
- [ ] Document seeded staff credentials.
- [ ] Document the half-open date range rule and same-day turnover behavior.
- [ ] Document the overlap exclusion constraint and why migrations are required instead of only `db:push`.

## Out Of Scope From PRD

- Payment processing.
- Email notifications.
- Multi-property management.
- Discount codes, taxes, service fees, and dynamic pricing.
- Analytics dashboards beyond reservation and inventory management.
- Customer profile management beyond authentication and reservation history.
- Public marketing pages.
