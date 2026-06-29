# Team Expense Tracker SaaS (Multi-Tenant)

A professional-grade expense management SaaS architecture designed to demonstrate enterprise backend concerns: strict data isolation, atomic financial operations, and idempotent external integrations.

## The Problem
Most SaaS demos are "shallow"—they show a nice UI but fail the moment the database gets complicated. This project was built to address the "hidden" problems that keep stakeholders up at night:
* **Race Conditions:** Can two admins approve the same expense at the same time? (No, handled via Postgres row-level locking).
* **Data Bleed:** Can a user in Organization A see data from Organization B? (No, enforced by Row-Level Security).
* **Double-Billing:** If a payment webhook retries, will it charge the user twice? (No, handled via an idempotent ledger).
* **Accountability:** If an expense is changed, can we prove who did it? (Yes, via immutable Postgres audit triggers).

## Architecture Highlights
* **Data Isolation:** Multi-tenancy is enforced at the database level using Postgres RLS policies, ensuring absolute tenant isolation regardless of frontend state.
* **Atomic Transactions:** Financial approvals are handled via secure Postgres RPCs using `FOR UPDATE` row locks, preventing negative wallet balances.
* **Idempotency:** Webhook integrations use a dedicated ledger to reject duplicate requests, protecting against network instability.
* **Audit Trail:** Every `INSERT`, `UPDATE`, and `DELETE` on sensitive tables is logged by an automatic Postgres trigger, creating an immutable history of database state.

## Tech Stack
* **Database + Auth:** Supabase (PostgreSQL + RLS)
* **Backend API:** Next.js Server Actions
* **Edge Logic:** Supabase Edge Functions (Deno/TypeScript)
* **Frontend:** Next.js App Router + Tailwind CSS

## Interactive Demo
[Link to your Vercel deployment here]

## Running Locally
1. Clone the repository.
2. Create a `.env.local` file with your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `npm install` and `npm run dev`.
4. Configure your Supabase project using the SQL schema found in `/docs/schema.sql`.