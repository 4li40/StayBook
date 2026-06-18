# StayBook

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Express, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Express** - Fast, unopinionated web framework
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
npm install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Copy the sample env files and fill in your values:

   ```bash
   cp apps/server/.env.example apps/server/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. Update your `apps/server/.env` file with your PostgreSQL connection details and a random auth secret (generate one with `openssl rand -base64 32`).

4. Apply the migrations to your database:

   ```bash
   npm run db:migrate
   ```

5. Seed room inventory, reviewer users, and sample reservations:

   ```bash
   npm run db:seed
   ```

   Seeded staff credentials:

   ```txt
   Email: staff@staybook.test
   Password: StayBook123!
   ```

   Seeded guest credentials:

   ```txt
   Email: guest.alex@staybook.test
   Password: StayBook123!

   Email: guest.mina@staybook.test
   Password: StayBook123!

   Email: guest.sam@staybook.test
   Password: StayBook123!
   ```

   The seed also creates active, upcoming, past, cancelled, overlapping, and same-day turnover reservation scenarios. Re-running the seed refreshes reservations for the seeded demo rooms and seeded guest accounts.

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Environment Variables

Sample files are provided at `apps/server/.env.example` and `apps/web/.env.example`. Copy them to `.env` and replace placeholder values.

### Server (`apps/server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. Neon, Supabase, or local). |
| `BETTER_AUTH_SECRET` | Yes | Random secret, 32+ characters. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Yes | Public URL where the API server is reachable. Defaults to `http://localhost:3000` in dev. |
| `CORS_ORIGIN` | Yes | Public URL where the web app is reachable (CORS allow-list origin). |
| `AUTH_COOKIE_SAME_SITE` | No | Cookie SameSite policy: `lax`, `strict`, or `none`. Defaults to `lax` in development and `none` in production. |
| `AUTH_COOKIE_SECURE` | No | Cookie Secure flag override: `true` or `false`. Defaults to `true` for HTTPS or `SameSite=none`; otherwise `false`. |
| `TRUST_PROXY` | No | Set to `true` only when the API is behind one trusted reverse proxy so rate limits use the client IP. Defaults to `false`. |
| `NODE_ENV` | No | `development`, `production`, or `test`. Defaults to `development`. |

### Web (`apps/web/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SERVER_URL` | Yes | Public URL where the API server is reachable. |

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@StayBook/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
StayBook/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Express)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `npm run dev`: Start all applications in development mode
- `npm run build`: Build all applications
- `npm run dev:web`: Start only the web application
- `npm run dev:server`: Start only the server
- `npm run check-types`: Check TypeScript types across all apps
- `npm run db:push`: Push schema changes to database for quick local experiments. Do not use this for normal setup because migrations include hand-written constraints.
- `npm run db:generate`: Generate database client/types
- `npm run db:migrate`: Run database migrations
- `npm run db:seed`: Seed rooms, amenities, reviewer accounts, and sample reservations
- `npm run db:studio`: Open database studio UI
