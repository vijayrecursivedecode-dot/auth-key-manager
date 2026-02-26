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
- GET/POST/PATCH/DELETE `/api/sellers`
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

## Telegram Bot
- Built with grammy framework, integrated into Express server startup
- Server-side bot: `server/telegram-bot.ts` — requires `TELEGRAM_BOT_TOKEN` secret to activate
- Downloadable standalone bot: `public/downloads/telegram-bot/` — users download from App Settings > Seller tab
  - Self-contained Node.js bot that users run on their own server
  - Configurable via `.env` file (TELEGRAM_BOT_TOKEN + API_URL pointing to seller API)
  - Download endpoint: GET `/api/download/telegram-bot` (serves zip file via archiver)
- Uses the platform's own Seller API (`/api/seller`) for all operations
- Commands: /start, /help, /setseller, /addapp, /myapps, /selectapp, /removeapp, /create, /delkey, /getkeys, /keyinfo, /verify, /adduser, /deluser, /getusers, /userdata, /resethwid, /ban, /unban, /stats, /appdetails, /status
- Sellers add their seller key via the bot (/setseller), then manage licenses/users via conversational commands
- In-memory state management for multi-step conversations with 5-minute timeout

## Discord Bot
- Downloadable standalone bot: `public/downloads/discord-bot/` — users download from App Settings > Seller tab
  - Self-contained Node.js bot using Discord.js v14 with slash commands
  - Configurable via `.env` file (TOKEN + API_URL pointing to seller API)
  - Download endpoint: GET `/api/download/discord-bot` (serves zip file via archiver)
  - Uses quick.db (SQLite) to store seller keys per guild
- Slash commands: /setseller (admin-only), /add-license, /delete-license, /verify-license, /license-info, /fetch-all-keys, /add-user, /delete-user, /verify-user, /user-data, /reset-user, /ban-user, /unban-user, /fetch-all-users, /app-stats, /app-details
- Purple themed embeds matching the platform design
- Large exports sent as file attachments (JSON)

## Seller API (POST /api/seller)
Extended seller API types: add, del, adduser, deluser, resetuser, banuser, unbanuser, validate, appdetails, stats, fetchallkeys, fetchallusers, info, verify, getuserdata

## Recent Changes
- 2026-02-26: Added Telegram bot (grammy) for managing licenses/users via seller API
- 2026-02-19: Added local username/password auth with login/register pages, license key required for registration
- 2026-02-19: Design overhaul - purple accent theme, animations, improved sidebar, redesigned landing page
- 2026-02-19: Added Statistics page with real-time analytics (per-app breakdowns, license/user/token stats)
- 2026-02-19: Added public client API (/api/1.2/) supporting init, login, register, license, upgrade, ban
- 2026-02-19: Added code snippet feature with 13 language support (C#, C++, Java, Python, etc.)
- 2026-02-19: Initial MVP build with full CRUD for apps, licenses, users, tokens
- Replit Auth integration for user authentication
