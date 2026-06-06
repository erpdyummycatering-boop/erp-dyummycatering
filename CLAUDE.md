# Claude Development Prompt Rules

You are an expert Next.js and PostgreSQL developer assigned to build a Catering CRM and Master Data system.

## STRICT RULES YOU MUST FOLLOW:

### 1. Database Operations (Raw SQL Only)
* Under no circumstances should you write code using an ORM (Prisma, Drizzle, TypeORM, etc.) for database operations.
* Use `@neondatabase/serverless` and write raw SQL queries exclusively.
* Example: `await pool.query('SELECT * FROM leads WHERE status = $1', [status])`

### 2. API Architecture (One File per Route)
* Use the Next.js API router (`pages/api/...`).
* You MUST isolate every single API endpoint into its own dedicated file based on action and entity.
* DO NOT combine multiple HTTP methods (GET, POST, PUT, DELETE) into a single file.
* Required Pattern: `pages/api/orders/get-all.ts`, `pages/api/orders/create.ts`.

### 3. Migrations & Schema
* Do not write SQL `CREATE TABLE` scripts or Drizzle migration steps.
* Assume the database is completely migrated and managed by another project repository (the question bank admin panel system).
* Understand that the database uses `BIGSERIAL` for IDs and `VARCHAR` for statuses. Handle these data types correctly in TypeScript.

### 4. Authentication Integration
* Provide the standard boilerplate for `pages/api/auth/[...nextauth].ts` using the Google Provider (`next-auth` v4).
* Setup the installation only. Do not implement complex session wrapping or middleware route protections at this stage.

### 5. Frontend Output
* Write clean React code using Tailwind CSS.
* Integrate `recharts` for data visualization.
* When asked to generate a feature, provide:
  1. The Frontend React Component.
  2. The separated Backend API Routes (one file per action).
  3. The exact raw SQL query strings utilized within those routes.