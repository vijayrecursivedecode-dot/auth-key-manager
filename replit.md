# KeyAuth Manager - Software Licensing Platform

## Overview
A KeyAuth-style software licensing and authentication management platform. Users can create applications, generate license keys, manage app users, create registration tokens, and configure app settings - all from a single dashboard. Includes a public client API compatible with KeyAuth-style client libraries.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Dual auth - Replit Auth (OIDC) + Local username/password auth (bcrypt + cookie sessions)
- **Routing**: wouter (client-side)

## Project Structure
```
client/src/
  pages/         - Landing, Login, Register, Dashboard, ManageApps, Licenses, AppUsers, Tokens, AppSettings, Statistics
  components/    - AppSidebar, ThemeProvider, ThemeToggle, ui/ (shadcn)
  hooks/         - use-auth, use-toast, use-mobile
  lib/           - queryClient, utils, auth-utils

server/
  index.ts       - Express server setup
  routes.ts      - All API routes (auth + CRUD + public client API)
  storage.ts     - DatabaseStorage with all CRUD operations
  db.ts          - PostgreSQL connection
  replit_integrations/auth/ - Replit Auth module

shared/
  schema.ts      - Drizzle schemas (applications, licenses, appUsers, tokens)
  models/auth.ts - User, session, and account schemas
```

## Key Data Models
- **applications**: owner's apps with name, version, secret, enabled flag, HWID lock
- **licenses**: license keys with duration, level, max uses, enabled status
- **appUsers**: end-users of apps with username, HWID, IP, ban status
- **tokens**: single-use registration tokens

## Dashboard API Endpoints (all require auth)
- GET/POST/PATCH/DELETE `/api/applications`
- POST `/api/applications/:id/reset-secret`
- GET/POST/PATCH/DELETE `/api/licenses`
- GET/POST/PATCH/DELETE `/api/app-users`
- GET/POST/DELETE `/api/tokens`
- GET `/api/statistics` - Aggregated analytics (totals, per-app breakdowns, by-level)

## Public Client API (POST /api/1.2/)
External applications (Java, C++, C#, Python, etc.) can call this endpoint to authenticate.
Supported request types (sent as `type` field in POST body):
- **init**: Initialize session with `name`, `ownerid`, `ver`, `secret` → returns `sessionid`
- **login**: Authenticate user with `username`, `pass`, `hwid`, `sessionid`
- **register**: Register user with `username`, `pass`, `key` (license), `hwid`, `sessionid`
- **license**: Validate license key with `key`, `hwid`, `sessionid`
- **upgrade**: Upgrade user subscription with `username`, `key`, `sessionid`
- **ban**: Ban current session user with `sessionid`

Sessions are stored in-memory with 1-hour expiry. Secret verification is supported on init.

## Code Snippets
The App Settings > Credentials tab includes code snippets for 13 languages showing how to initialize the client API with the user's actual credentials and API URL.

## Running
- `npm run dev` starts both frontend and backend on port 5000
- `npm run db:push` syncs database schema

## Design & Theme
- Purple accent color (hue 265) with dark mode default
- Inter font family, JetBrains Mono for code
- Smooth fade-in and slide-up animations on page transitions
- Sidebar with grouped navigation (Main + Insights sections)
- Branded logo with purple icon badge

## Recent Changes
- 2026-02-19: Added local username/password auth with login/register pages, license key required for registration
- 2026-02-19: Design overhaul - purple accent theme, animations, improved sidebar, redesigned landing page
- 2026-02-19: Added Statistics page with real-time analytics (per-app breakdowns, license/user/token stats)
- 2026-02-19: Added public client API (/api/1.2/) supporting init, login, register, license, upgrade, ban
- 2026-02-19: Added code snippet feature with 13 language support (C#, C++, Java, Python, etc.)
- 2026-02-19: Initial MVP build with full CRUD for apps, licenses, users, tokens
- Replit Auth integration for user authentication
