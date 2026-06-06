# AI Coding Agent Instructions

**Project Context:** Next.js Catering ERP & CRM Application.

When building, generating, or refactoring code for this project, you MUST strictly adhere to the following directives:

## 1. API Routing & File Structure (CRITICAL)

* Use the **Next.js App Router** for all backend APIs (`app/api/...`).
* Each route file uses the standard `route.ts` convention and may export multiple HTTP method handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) **within the same resource file** using named exports.
* **ONE RESOURCE = ONE FILE.** Do not split GET/POST into separate files; instead, export them as named functions from the same `route.ts`.
* Correct Structure Example:
  * `app/api/customers/route.ts` — exports `GET` (list) and `POST` (create)
  * `app/api/customers/[id]/route.ts` — exports `GET` (detail), `PUT` (update), `DELETE`
  * `app/api/production-schedules/[id]/generate-pr/route.ts` — exports `POST` only

## 2. Database & Data Fetching (CRITICAL)

* **NO ORM USAGE:** Do not use Prisma, Drizzle ORM, TypeORM, or Sequelize for application logic.
* **RAW SQL ONLY:** Execute all database queries using raw SQL strings via the `@neondatabase/serverless` pool.
* **Parameterization:** Always use parameterized queries (e.g., `WHERE id = $1`) to prevent SQL injection.
* **No Migration Files:** Do not generate standalone SQL migration scripts. Schema is managed via the seed SQL in `refs/skema_seed_erp_catering_dengan_cost_control.sql`.
* **Drizzle Exception:** Drizzle is only allowed if writing standalone seed scripts, not for runtime API queries.
* **Tables in scope:** `users`, `customers`, `leads`, `products`, `recipes`, `orders`, `order_items`, `production_schedules`, `schedule_orders`, `schedule_menus`, `purchase_requests`, `pr_items`, `purchase_orders`, `overheads`.

## 3. Technology Stack & Features

* **Auth:** `next-auth` v4 with Google SSO boilerplate. Do not enforce strict session guards in this phase.
* **Charts:** `recharts` — support Line, Area, Vertical Bar, Pie, and RadialBar charts.
* **Exports:** `xlsx` for Excel downloads; print media CSS for PDF generation.
* **Styling:** Tailwind CSS v4 with `lucide-react` icons. Font: `Source Sans 3` / `Source Sans Pro`. Clean, non-bold default weights.
* **Color Palette:** Primary `#5005A6`, Sidebar `#3b047a`, Secondary `#378ADD`, Danger `#E24B4A`, Warning `#BA7517`, Success `#639922`.

## 4. Types & Identifiers

* Database IDs are `BIGSERIAL` (use `number` or `string` in TypeScript, not UUIDs).
* Statuses are `VARCHAR` strings (not ENUMs).