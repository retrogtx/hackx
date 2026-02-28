# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SME-Plug** — a hot-swappable Subject Matter Expert plugin platform for AI agents. Domain experts create plugins (knowledge base + decision trees + expert persona), developers install them into any AI agent via SDK/API, and end users get cited, hallucination-guarded answers.

Hackathon project. See `PRD.md` for product requirements and `SPEC.md` for full technical specification.

## TODO Tracking

**`PRD.md` section 5 is the single source of truth for all TODOs.** It contains a phased checklist (Phase 1–5 + Stretch Goals) tracking every implementation task.

**After completing any task, immediately update `PRD.md` section 5** — change `- [ ]` to `- [x]` for the relevant item. This keeps progress visible across sessions. If a task is partially done, leave it unchecked but add a note in parentheses (e.g., `- [ ] Create schema (WIP — 5/8 tables done)`).

## Commands

```bash
bun dev          # Start Next.js dev server
bun run build    # Production build
bun run lint     # ESLint
bun run start    # Start production server

# Database (Drizzle)
bunx drizzle-kit push      # Push schema changes to Supabase Postgres
bunx drizzle-kit generate  # Generate SQL migration files
bunx drizzle-kit migrate   # Run pending migrations
bunx drizzle-kit studio    # Open Drizzle Studio (DB browser)
```

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Clerk** for auth (middleware-protected routes, webhook syncs users to DB)
- **Drizzle ORM** with `postgres` driver against **Supabase Postgres** (pgvector enabled)
- **Supabase Storage** for file uploads (PDFs, markdown) — not used for auth or DB queries
- **OpenAI** — GPT-4o for generation, text-embedding-3-small (1536-dim) for embeddings
- **Tailwind CSS v4** + shadcn/ui
- **Bun** as package manager

## Architecture

### Core Query Pipeline (the main product loop)

When an external agent sends a query through a plugin:

1. **Authenticate** — validate API key, resolve plugin
2. **Embed query** — OpenAI text-embedding-3-small
3. **Retrieve sources** — pgvector cosine similarity on `knowledge_chunks` (top-K=8, threshold 0.75)
4. **Decision tree evaluation** — walk JSON-based condition/question/action nodes
5. **LLM generation** — GPT-4o with expert system prompt + retrieved chunks + decision path
6. **Citation post-processing** — map `[Source N]` refs to actual documents, compute confidence
7. **Hallucination guard** — if confidence=low, replace answer with refusal
8. **Audit log** — store query, response, citations, decision path, latency

### Auth Flow

- Clerk handles all sign-in/sign-up UI and session management
- `middleware.ts` protects `(dashboard)` routes via Clerk's `authMiddleware`
- Clerk webhook (`/api/webhooks/clerk/route.ts`) syncs user creates/updates/deletes to the `users` table
- `lib/auth.ts` exports `requireUser()` which resolves Clerk session → DB user record

### Database

Schema defined in `src/lib/db/schema.ts` (Drizzle). Key tables:
- `users` — synced from Clerk (stores `clerkId`)
- `plugins` — SME plugin definitions (system prompt, citation mode, domain)
- `knowledge_documents` → `knowledge_chunks` — uploaded docs chunked with pgvector embeddings
- `decision_trees` — JSON decision graphs per plugin
- `api_keys` — hashed keys for external agent access
- `query_logs` — full audit trail with citations and decision paths

DB client lives in `src/lib/db/index.ts`. pgvector similarity search uses Drizzle's `sql` template tag for raw vector ops.

### Two Auth Modes

1. **Web app routes** — Clerk JWT sessions (middleware-enforced)
2. **`/api/v1/query`** — API key auth (Bearer token, looked up in `api_keys` table) for external agent integrations

### SDK (`packages/sdk/`)

TypeScript package (`@sme-plug/sdk`) with framework adapters:
- `index.ts` — core `SMEPlug` client with `query()` and `setActivePlugin()` for hot-swap
- `langchain.ts` — `SMEPlugTool` adapter for LangChain agents
- `autogpt.ts` — AutoGPT adapter

## Key Patterns

- **Supabase is for Postgres + Storage only** — never use Supabase Auth or Supabase client for DB queries. All DB access goes through Drizzle.
- **Decision trees are JSON** stored in a `jsonb` column, executed by a custom TypeScript engine in `lib/engine/decision-tree.ts`.
- **Citations are mandatory by default** — every plugin response must link claims to source chunks.
- **Plugins are stateless per-request** — hot-swapping is just changing which plugin slug is sent in the next API call.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- `DATABASE_URL` (Supabase Postgres connection string for Drizzle)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (storage only)
- `OPENAI_API_KEY`
