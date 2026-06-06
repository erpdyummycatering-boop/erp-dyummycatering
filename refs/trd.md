# Technical Requirements Document (TRD)

**Project Name:** Catering Smart CRM & Master Data System
**Version:** 1.0

## 1. Architecture & Infrastructure
* **Deployment:** Vercel (Serverless environment).
* **Framework:** Next.js.
* **API Architecture:** Next API Router (`pages/api/...`).
* **Database:** Neon Serverless Postgres (`@neondatabase/serverless`).
* **Authentication:** NextAuth v4 (Google SSO provider installed and configured, but implementation/middleware enforcement is bypassed for this development phase).

## 2. Frontend Tech Stack
* **UI/Styling:** React, Tailwind CSS.
* **Icons:** `lucide-react`.
* **Data Visualization:** `recharts` (Line, Vertical Bar, Pie, and RadialBar/Gauge charts).
* **Document Handling:**
  * **PDF:** `pdfmake` or native browser print CSS tailored for A5 logic.
  * **Excel:** `xlsx` library for exporting table data.

## 3. Backend & Database Rules
* **No ORM for Application Logic:** The use of ORMs (Prisma, TypeORM, Drizzle ORM) for fetching or mutating data in API routes is **strictly forbidden**.
* **Raw SQL Queries:** All database interactions must use raw SQL queries via the Neon serverless driver.
* **Drizzle Scope:** Drizzle is permitted **only** for running seed scripts.
* **No Migrations Required:** Do not generate or run table migrations. The required tables already exist in the Neon Postgres database, having been migrated by another project repository (question bank admin panel system).
* **Route Separation:** API endpoints must be strictly isolated. **One route per file**.
  * *Example:* `pages/api/leads/create.ts`, `pages/api/leads/get-list.ts`, `pages/api/leads/delete-by-id.ts`.
  * *Forbidden:* Combining GET, POST, PUT, DELETE into a single `pages/api/leads.ts` file.

## 4. Database Constraints
* **Primary Keys:** Use `BIGSERIAL` (No UUIDs).
* **Status Fields:** Use `VARCHAR` instead of ENUM types to ensure flexibility.