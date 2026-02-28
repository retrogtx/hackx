# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Lexic** — a hot-swappable Subject Matter Expert plugin platform for AI agents. Domain experts create plugins (knowledge base + decision trees + expert persona), developers integrate them into any AI agent via SDK/API, and end users get cited, hallucination-guarded answers.

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

# SDK
cd packages/sdk && npx tsc --noEmit    # Type-check SDK
npx tsx packages/sdk/src/__tests__/sdk.test.ts  # Run SDK tests (69 tests)
```

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Clerk** for auth (middleware-protected routes, auto-sync users to DB on first visit via `requireUser()`)
- **Drizzle ORM** with `postgres` driver against **Supabase Postgres** (pgvector enabled)
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) — GPT-5 for generation, text-embedding-3-small (1536-dim) for embeddings; all LLM/embedding calls go through the AI SDK, never raw OpenAI client
- **Tailwind CSS v4** + shadcn/ui
- **Bun** as package manager

## Architecture

### Core Query Pipeline (the main product loop)

When an external agent sends a query through a plugin:

1. **Authenticate** — validate API key, resolve plugin
2. **Embed query** — Vercel AI SDK `embed()` with OpenAI text-embedding-3-small
3. **Retrieve sources** — pgvector cosine similarity on `knowledge_chunks` (top-K=8, threshold 0.3)
4. **Decision tree evaluation** — walk JSON-based condition/question/action nodes
5. **LLM generation** — Vercel AI SDK `generateText()`/`streamText()` with GPT-5, expert system prompt + retrieved chunks + decision path + web search tool
6. **Citation post-processing** — map `[Source N]` refs to actual documents, strip phantom refs, compute confidence
7. **Hallucination guard** — if zero real citations, self-refusal detected, or phantom majority → replace answer with refusal
8. **Audit log** — store query, response, citations, decision path, latency

### Auth Flow

- Clerk handles all sign-in/sign-up UI and session management
- `middleware.ts` protects dashboard routes (`/plugins`, `/api-keys`, `/api/plugins`, `/api/sandbox`) via Clerk's `clerkMiddleware` + `createRouteMatcher`
- `lib/auth.ts` exports `requireUser()` which resolves Clerk session → DB user record, **auto-creating** the user on first visit via `currentUser()` + upsert (no webhook needed)

### Database

Schema defined in `lib/db/schema.ts` (Drizzle). Key tables:
- `users` — synced from Clerk (stores `clerkId`), auto-created on first visit
- `plugins` — plugin definitions (system prompt, citation mode, domain, config)
- `knowledge_documents` → `knowledge_chunks` — uploaded docs chunked with pgvector embeddings
- `decision_trees` — JSON decision graphs per plugin
- `api_keys` — hashed + encrypted keys for external agent access
- `query_logs` — full audit trail with citations and decision paths
- `collaboration_rooms` — multi-expert room definitions (expert slugs, mode, max rounds)
- `collaboration_sessions` — individual deliberation sessions (rounds, consensus, status)

DB client lives in `lib/db/index.ts`. pgvector similarity search uses Drizzle's `cosineDistance` + `sql` template tag.

### Collaboration Engine (Multi-Expert Adversarial Reasoning)

When multiple experts are needed:

1. **Resolve experts** — load all plugin slugs, retrieve sources + decision trees for each
2. **Multi-round deliberation** — each expert generates a response with their own RAG + decision tree pipeline
3. **Cross-expert context** — in rounds 2+, each expert sees all prior responses and can revise
4. **Consensus synthesis** — an AI moderator synthesizes final answer with agreement level, conflicts, per-expert contributions
5. **Session persistence** — rounds, consensus, and metadata stored in `collaboration_sessions`

Three modes: **debate** (multi-round adversarial), **consensus** (single round + synthesis), **review** (one leads, others critique).

### Two Auth Modes

1. **Web app routes** — Clerk JWT sessions (middleware-enforced)
2. **`/api/v1/query`** and **`/api/v1/collaborate`** — API key auth (Bearer token) for external agent integrations

### API Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/v1/query` | API key | Main query endpoint (JSON + SSE streaming) |
| `POST /api/v1/collaborate` | API key | Multi-expert collaboration (JSON + SSE streaming) |
| `POST /api/sandbox/[pluginId]` | Clerk | Sandbox testing (SSE streaming) |
| `GET/POST /api/collaboration-rooms` | Clerk | List / create collaboration rooms |
| `GET/DELETE /api/collaboration-rooms/[id]` | Clerk | Room detail / delete |
| `POST /api/collaboration-rooms/sandbox` | Clerk | Collaboration sandbox (SSE streaming) |
| `GET/POST /api/plugins` | Clerk | List / create plugins |
| `GET/PATCH/DELETE /api/plugins/[id]` | Clerk | Plugin CRUD |
| `GET /api/plugins/[id]/export` | Clerk | Export plugin as JSON |
| `GET/POST/DELETE /api/plugins/[id]/documents` | Clerk | Knowledge document management |
| `GET/POST/PUT/DELETE /api/plugins/[id]/trees` | Clerk | Decision tree CRUD |
| `GET/POST/PATCH/DELETE /api/api-keys` | Clerk | API key management (create, list, reveal, revoke) |
| `GET /api/marketplace/[slug]/download` | Public | Download shared plugin |

### SDK (`packages/sdk/`)

TypeScript package (`lexic-sdk`) with framework adapters:
- `index.ts` — core `Lexic` client with `query()`, `queryStream()`, `queryStreamToResult()`, `setActivePlugin()` for hot-swap, and `collaborate()` / `collaborateStream()` for multi-expert collaboration rooms. Supports conversation `context`, per-request `options` (citationMode, maxSources, includeDecisionPath). All responses are normalized with safe defaults for missing fields.
- `langchain.ts` — `LexicTool` adapter for LangChain agents (returns JSON with full citation metadata)
- `autogpt.ts` — `LexicAutoGPT` adapter (returns human-readable text with citations and decision path)
- `types.ts` — shared types: `QueryResult`, `Citation`, `DecisionStep`, `StreamEvent`, `QueryRequestOptions`, `CollaborateOptions`, `CollaborationResult`, `CollaborationStreamEvent`, `ConsensusResult`, `ConflictEntry`
- `__tests__/sdk.test.ts` — 69 unit tests covering normalization, adapters, error handling

## Key Patterns

- **All LLM and embedding calls go through Vercel AI SDK** — use `generateText()`/`streamText()` from `ai` and `openai()` model from `@ai-sdk/openai`. Never import or use the raw `openai` npm package directly.
- **Supabase is for Postgres only** — all DB access goes through Drizzle. Storage integration was removed (knowledge base uses inline text upload + chunking).
- **Decision trees are JSON** stored in a `jsonb` column, executed by a custom TypeScript engine in `lib/engine/decision-tree.ts`.
- **Citations are mandatory by default** — every plugin response must link claims to source chunks.
- **Plugins are stateless per-request** — hot-swapping is just changing which plugin slug is sent in the next API call.

## Git Workflow (MANDATORY)

**No one pushes directly to `main`. No exceptions.**

1. **Always create a feature branch** from `main` before making changes:
   ```bash
   git checkout main && git pull origin main
   git checkout -b <type>/<short-description>   # e.g. fix/api-key-ownership, feat/rate-limiting
   ```
2. **Commit to your feature branch**, push it, then open a PR against `main`.
3. **Every PR requires at least 1 review approval** before merging.
4. **Never force-push to `main`** or merge without a reviewed PR.
5. **Branch naming**: `feat/`, `fix/`, `chore/`, `docs/` prefixes.
6. **Delete branches after merge.**

If Claude Code or any agent is making changes, it MUST:
- Work on a feature branch, never on `main`
- Create a PR when done, never merge its own PR
- Wait for a human review before the PR is merged

## Environment Variables

Required in `.env`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `DATABASE_URL` (Supabase Postgres connection string for Drizzle)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ENCRYPTION_KEY` (for AES-256-GCM API key encryption in `lib/utils/api-key.ts`)
