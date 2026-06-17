# StayBook Product Requirements Document

## Problem Statement

Hotel guests need a simple way to find rooms that are truly available for their travel dates, reserve a room with clear pricing, and manage their reservations without contacting staff. Hotel staff need a reliable operational view of room inventory and incoming reservations so they can keep availability accurate and intervene when reservations need to be cancelled.

The core risk is correctness under date overlap and concurrent booking attempts. StayBook must prevent a room from being shown or booked when it has an overlapping confirmed reservation, while still allowing same-day turnover where one guest checks out on the same date another guest checks in.

## Solution

StayBook will be a small full-stack booking application using the existing TypeScript monorepo foundation: React with TanStack Router for the web app, Express for the API, Better Auth for authentication, Drizzle with PostgreSQL for persistence, and shared UI primitives for consistent forms and layout.

Guests will register or log in, search available rooms by check-in date, check-out date, and party size, inspect room details, book a selected date range, review total price before confirmation, and manage upcoming and past reservations. Staff will log in through the same app with a staff role, manage active room inventory, view reservations with operational filters, and manually cancel reservations.

Availability and booking integrity will be enforced on the backend and in the database. The application will use half-open date ranges, where check-in is inclusive and check-out is exclusive. This means a reservation from July 1 to July 3 blocks the nights of July 1 and July 2, and another guest may check in on July 3 for the same room.

## User Stories

1. As a guest, I want to create an account with my name, email, and password, so that I can book and manage reservations.
2. As a guest, I want to log in securely, so that only I can access my reservations.
3. As a guest, I want invalid registration and login forms to show useful validation errors, so that I know how to fix them.
4. As a guest, I want to search for rooms by check-in date, check-out date, and number of guests, so that I only see relevant options.
5. As a guest, I want the app to reject a check-out date that is not after the check-in date, so that I cannot create an invalid stay.
6. As a guest, I want unavailable rooms hidden from search results, so that I do not attempt to book rooms that are already reserved.
7. As a guest, I want same-day room turnover to work, so that I can book a room on the date another guest checks out.
8. As a guest, I want to see room cards with type, price, capacity, and a representative image, so that I can compare options quickly.
9. As a guest, I want to filter out rooms below my guest count, so that I do not book a room that cannot accommodate my party.
10. As a guest, I want to open a room detail page, so that I can review photos, description, amenities, occupancy, and nightly price.
11. As a guest, I want placeholder images to appear consistently where real room photos are not available, so that the interface never looks broken.
12. As a guest, I want to start a reservation from a room detail page, so that my selected room and dates carry into checkout.
13. As a guest, I want to see the number of nights and total price before confirming, so that I understand the cost.
14. As a guest, I want total price calculated as price per night multiplied by number of nights, so that pricing is predictable.
15. As a guest, I want the server to recalculate price during booking, so that client-side tampering cannot change the amount.
16. As a guest, I want clear success feedback after booking, so that I know my reservation is confirmed.
17. As a guest, I want clear conflict feedback if another guest books the same room before me, so that I understand why my booking failed.
18. As a guest, I want to view my upcoming reservations, so that I can plan my stays.
19. As a guest, I want to view my past reservations, so that I can review my booking history.
20. As a guest, I want cancelled reservations to be labeled clearly, so that I understand their current state.
21. As a guest, I want to cancel an upcoming reservation more than 24 hours before check-in, so that I can manage changed plans.
22. As a guest, I want the app to prevent cancellation within 24 hours of check-in, so that hotel policy is enforced consistently.
23. As a guest, I want to be prevented from accessing staff pages and APIs, so that staff operations remain protected.
24. As a staff member, I want to log in through the same authentication flow, so that I do not need a separate application.
25. As a staff member, I want my staff role enforced by the backend, so that guests cannot perform staff actions by editing the frontend.
26. As a staff member, I want to add rooms with type, description, capacity, price, amenities, and photos, so that inventory can be created.
27. As a staff member, I want room forms to validate required fields and numeric ranges, so that inventory data stays usable.
28. As a staff member, I want to edit room details, so that price, copy, capacity, amenities, and photos can be corrected.
29. As a staff member, I want to deactivate rooms, so that unavailable inventory can be hidden from guests without deleting history.
30. As a staff member, I want deactivated rooms to remain visible in staff tools, so that I can audit and restore inventory decisions later.
31. As a staff member, I want deactivated rooms excluded from guest search results, so that guests cannot book them.
32. As a staff member, I want to view all reservations, so that I can monitor hotel demand.
33. As a staff member, I want to filter reservations by date range, so that I can focus on a relevant operating window.
34. As a staff member, I want to filter reservations by room, so that I can inspect the schedule for a specific room.
35. As a staff member, I want to filter reservations by status, so that I can separate upcoming, active, cancelled, and historical reservations.
36. As a staff member, I want reservation lists to be paginated, so that the app stays responsive as data grows.
37. As a staff member, I want to manually cancel any reservation, so that I can resolve operational issues.
38. As a staff member, I want manual cancellations to preserve the reservation record, so that booking history is auditable.
39. As an engineer, I want reservation overlap logic centralized in domain services, so that routes and UI do not duplicate business rules.
40. As an engineer, I want database constraints to prevent overlapping confirmed reservations, so that race conditions cannot create double bookings.
41. As an engineer, I want every endpoint to validate and sanitize input on the server, so that malformed or hostile input is rejected consistently.
42. As an engineer, I want list endpoints to use pagination metadata, so that clients can build reliable next and previous states.
43. As an engineer, I want a realistic seeder, so that reviewers can run the app and exercise flows immediately.
44. As a reviewer, I want documented setup commands, so that I can install, migrate, seed, and run the project with minimal friction.

## Implementation Decisions

- Keep the existing monorepo split between web app, API app, shared database package, shared auth package, shared environment package, and shared UI package.
- Use Better Auth email/password authentication as the session foundation and extend the user model with a role field. Roles are `guest` and `staff`.
- Register public users as guests by default. Seed at least one staff user instead of exposing public staff self-registration.
- Enforce authorization in Express middleware before every protected API handler. Guest-only endpoints require an authenticated guest. Staff-only endpoints require an authenticated staff user.
- Add a booking domain schema with rooms, room photos, amenities or room amenity links, and reservations.
- Store rooms with at least name, type, description, maximum guest count, nightly price in cents, active flag, created timestamp, and updated timestamp.
- Store reservations with room, guest, check-in date, check-out date, total price in cents, status, cancellation metadata, created timestamp, and updated timestamp.
- Treat reservation date ranges as half-open intervals: `[check_in, check_out)`.
- Consider only confirmed reservations as blocking inventory. Cancelled reservations remain in history but do not block future availability.
- Derive operational states from reservation status and dates: upcoming is confirmed with check-in in the future, active is confirmed where today is within the stay range, past is confirmed with check-out before or on today, and cancelled is explicitly stored.
- Use a PostgreSQL exclusion constraint for confirmed reservation overlap on the same room. The constraint should compare room id equality and date range overlap, with check-out exclusive. This may require enabling the `btree_gist` extension.
- Add supporting indexes for availability and staff reservation filters, including room id, check-in date, check-out date, reservation status, guest id, and room active state.
- Implement availability search with a single database query that filters active rooms by capacity and excludes rooms with overlapping confirmed reservations.
- Implement booking creation in a transaction where the server validates dates, verifies the room is active and has enough capacity, calculates total nights and price from stored room price, inserts the reservation, and relies on the database constraint to reject concurrent overlaps.
- Return a clear conflict response when the database rejects a booking because an overlapping confirmed reservation already exists.
- Validate all API payloads and query parameters with schemas at the route boundary. Strip unknown fields so endpoints only accept explicitly permitted input.
- Avoid raw string concatenation in database queries. Use Drizzle query builders or parameterized SQL for any migration-only database features that Drizzle cannot express directly.
- Add rate limiting to authentication endpoints, with stricter limits for login and registration than ordinary read endpoints.
- Use consistent API response shapes for success, validation errors, authorization failures, not found errors, conflicts, and unexpected failures.
- Use HTTP-only secure cookies from Better Auth for session handling. Do not expose tokens in local storage.
- Build guest routes for room search, room details, booking confirmation, and reservation history.
- Build staff routes for room inventory management and reservation management.
- Use existing shared UI primitives for forms, buttons, cards, fields, inputs, checkboxes, dropdowns, skeletons, and notifications.
- Each primary screen must handle loading, empty, error, and success states.
- Room and reservation forms must show field-level validation errors and preserve user-entered values when validation fails.
- Implement seed data with at least 10 active rooms across varied room types, capacities, amenities, photos, and prices; one staff account; multiple guest accounts; and a mix of upcoming, active, past, and cancelled reservations.
- Seed data should be deterministic enough for reviewers to use documented credentials and predictable enough to demonstrate overlap edge cases.
- Update project documentation with install, environment, migration, seed, and run commands, plus seeded account credentials.

## Testing Decisions

- Test behavior at the highest useful seams: API request/response behavior for authorization, room availability, booking creation, cancellation rules, staff room management, and staff reservation filtering.
- Add database-level tests or migration verification for the reservation overlap exclusion constraint because this is the most important correctness requirement.
- Test availability with edge cases: overlapping start, overlapping end, fully contained range, range containing an existing reservation, same-day checkout and check-in, inactive rooms, insufficient capacity, and cancelled reservations.
- Test concurrent booking attempts against the same room and overlapping date range. The expected behavior is one confirmed reservation and one conflict response.
- Test guest cancellation windows by checking reservations more than 24 hours before check-in, exactly at the cutoff, and inside the cutoff.
- Test role boundaries from the API layer, not only from frontend navigation. Guests must be rejected from staff endpoints, staff must be rejected from guest booking actions where appropriate, and unauthenticated users must be rejected from protected endpoints.
- Test server validation for malformed dates, invalid guest counts, invalid pagination values, unexpected fields, invalid prices, and missing required fields.
- Test pagination response metadata for room and reservation list endpoints.
- Keep frontend tests focused on visible behavior: form validation messaging, loading states, empty states, successful booking confirmation, and role-specific navigation.
- Seed script verification should confirm that seeded users, rooms, and reservations exist and that the app can be used immediately after running documented setup steps.

## Out of Scope

- Payment processing and payment authorization.
- Email notifications, reminders, or confirmation emails.
- Multi-property hotel management.
- Discount codes, taxes, service fees, and dynamic pricing.
- Room assignment across multiple identical units beyond the room records represented in the database.
- Mobile-specific responsive polish beyond a usable desktop-first layout.
- Admin analytics dashboards beyond reservation and inventory management.
- Customer profile management beyond authentication and reservation history.
- Public marketing pages.
- Comprehensive test coverage beyond the critical correctness, security, and availability paths.

## Further Notes

- The most important acceptance criterion is that overlapping confirmed reservations cannot exist for the same room, even under concurrent requests.
- The README should make reviewer setup boring: install dependencies, configure the database, run migrations, run the seeder, start the app, and log in with seeded credentials.
- The API and data model should leave natural extension points for future discounts, multi-property support, and more detailed room inventory without rewriting the reservation core.
- Dates should be handled consistently as hotel-local calendar dates for check-in and check-out, not arbitrary client timestamps.
- Any environment secrets, database URLs, and auth secrets must be documented through sample environment variables and never committed with real values.
