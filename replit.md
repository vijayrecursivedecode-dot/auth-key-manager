# KeyVault - Software Licensing Platform

## Overview
A KeyAuth-style software licensing and authentication management platform. Users can create applications, generate license keys, manage app users, create registration tokens, and configure app settings - all from a single dashboard.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)
- **Routing**: wouter (client-side)

## Project Structure
```
client/src/
  pages/         - Landing, Dashboard, ManageApps, Licenses, AppUsers, Tokens, AppSettings
  components/    - AppSidebar, ThemeProvider, ThemeToggle, ui/ (shadcn)
  hooks/         - use-auth, use-toast, use-mobile
  lib/           - queryClient, utils, auth-utils

server/
  index.ts       - Express server setup
  routes.ts      - All API routes (auth + CRUD)
  storage.ts     - DatabaseStorage with all CRUD operations
  db.ts          - PostgreSQL connection
  replit_integrations/auth/ - Replit Auth module

shared/
  schema.ts      - Drizzle schemas (applications, licenses, appUsers, tokens)
  models/auth.ts - User and session schemas
```

## Key Data Models
- **applications**: owner's apps with name, version, secret, enabled flag, HWID lock
- **licenses**: license keys with duration, level, max uses, enabled status
- **appUsers**: end-users of apps with username, HWID, IP, ban status
- **tokens**: single-use registration tokens

## API Endpoints (all require auth)
- GET/POST/PATCH/DELETE `/api/applications`
- POST `/api/applications/:id/reset-secret`
- GET/POST/PATCH/DELETE `/api/licenses`
- GET/POST/PATCH/DELETE `/api/app-users`
- GET/POST/DELETE `/api/tokens`

## Running
- `npm run dev` starts both frontend and backend on port 5000
- `npm run db:push` syncs database schema

## Recent Changes
- 2026-02-19: Initial MVP build with full CRUD for apps, licenses, users, tokens
- Dark mode theme with Inter font family
- Replit Auth integration for user authentication
