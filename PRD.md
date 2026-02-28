# PRD: Lexic — Hot-Swappable Subject Matter Expert Plugin

## 1. Vision

**One-liner:** A plug-and-play platform where anyone can create, share, and inject domain-expert "brains" into any AI agent — turning a generalist chatbot into a verified specialist in seconds.

**Why this matters for real people:** Today, if a small manufacturer asks ChatGPT about ASME pressure vessel codes, or a clinic admin asks an AI about HIPAA billing edge-cases, the AI confidently guesses. Lexic kills hallucination by hot-swapping in a verified expert module — complete with decision trees, source-of-truth citations, and domain reasoning — so the answer is auditable, correct, and useful.

---

## 2. How It Works (Plain English)

Lexic is a **web platform + API**. It is NOT a CLI tool, not a library you import — it's a hosted service.

**The core idea:** A "plugin" is a self-contained package of expertise that lives on our servers — the expert's knowledge base (PDFs, docs), decision trees (structured reasoning), and an expert persona prompt, all bundled together. Developers don't "install" a plugin locally. They just reference it by slug in an API call. That's what makes it hot-swappable — it's a parameter, not a dependency.

**Three actors, one API:**

1. **Expert** builds a plugin on our web app (uploads PDFs, creates decision trees, tests in sandbox, publishes)
2. **Developer** calls `POST /api/v1/query` with `{ plugin: "structural-eng-v1", query: "..." }` — gets back a cited, decision-tree-backed answer. No SDK required; it's just an HTTP call. The optional SDK/LangChain adapter is a convenience wrapper.
3. **End user** never touches our platform — they just see better, cited answers in whatever AI tool their company already uses.

**Hot-swap = just change the slug.** Same API key, same endpoint, different `"plugin"` value → the agent is now a different kind of expert. No restart, no retrain, no redeploy.

**What the API response looks like:**
```json
{
  "answer": "45mm nominal cover (IS 456:2000, Table 16, Clause 26.4.2) [Source 1]",
  "citations": [{ "document": "IS 456:2000", "page": 47, "section": "Clause 26.4.2", "excerpt": "..." }],
  "decisionPath": [{ "step": 1, "label": "Exposure?", "value": "severe" }, ...],
  "confidence": "high"
}
```

---

## 3. Target Users & Day-to-Day Value

### Primary Users

| Persona | Pain Today | Lexic Value |
|---|---|---|
| **Domain Expert / Consultant** | Knowledge trapped in their head or PDFs; can't scale themselves | Create a Lexic plugin once → it works 24/7 inside any AI agent, earns royalties |
| **AI Agent Builder / Developer** | Agents hallucinate on specialized tasks; building domain logic from scratch is expensive | Install a verified Lexic plugin in 3 lines of code; swap domains without retraining |
| **End Business User** (factory manager, clinic admin, compliance officer) | Needs expert-grade answers but can't afford a consultant for every question | Ask their AI agent domain questions and get cited, decision-tree-backed answers |

### Day-to-Day Use Cases

1. **Structural Engineering Firm** — Agent reviews uploaded drawings → Lexic plugin enforces IS 456 / ACI 318 checks → flags non-compliant beam sizes with citations.
2. **Healthcare Clinic** — Front-desk AI handles insurance queries → Lexic plugin injects CPT/ICD coding decision trees → answers with CMS source links.
3. **E-commerce Seller** — AI agent handles customer returns → Lexic plugin for "Consumer Protection Act" ensures legally correct responses.
4. **Legal Freelancer** — Contract review agent → Lexic plugin for Indian Contract Act → highlights risky clauses with section references.
5. **Agri-tech Startup** — Farmer chatbot → Lexic plugin for crop disease diagnosis → follows ICAR decision tree → cites published advisories.

---

## 4. Product Features (MVP — Hackathon Scope)

### 3.1 Plugin Builder (Web App)

- **Knowledge Base Upload**: Upload PDFs, markdown, URLs, or structured JSON as the domain's "Source of Truth"
- **Decision Tree Editor**: Visual node-based editor to create domain reasoning flows (if → then → else chains)
- **System Prompt Composer**: Auto-generates the expert persona prompt ("Think like a Structural Engineer") with injected constraints
- **Citation Rules**: Define mandatory citation patterns — every claim must link back to an uploaded source
- **Test Sandbox**: Chat with your plugin in-browser before publishing to verify behavior
- **Publish & Version**: One-click publish with semantic versioning; consumers pin to a version

### 3.2 Plugin Marketplace / Registry

- **Browse & Search**: Filter plugins by domain, rating, framework compatibility
- **Install via API key or SDK**: `lexic.install("structural-engineering-v2")` — 1 line
- **Ratings & Reviews**: Users rate plugin accuracy
- **Usage Analytics Dashboard**: Plugin creators see install count, query volume, accuracy feedback

### 3.3 Universal Agent Integration Layer

- **Framework Adapters**: Pre-built adapters for LangChain, AutoGPT, CrewAI, OpenAI Assistants API
- **REST API**: For any custom agent — POST the user query + plugin ID → get expert-augmented response
- **Hot-Swap at Runtime**: Switch the active plugin mid-conversation without restart
- **Multi-Plugin Stacking**: Combine plugins (e.g., "Structural Engineering" + "Indian Building Codes") with conflict resolution

### 3.4 Citation & Audit Engine

- **Inline Citations**: Every response chunk tagged with `[Source: document_name, page X, section Y]`
- **Confidence Scoring**: Each answer gets a confidence level (High / Medium / Low) based on source coverage
- **Audit Log**: Full trace of which decision tree nodes fired, which sources were retrieved, what reasoning path was taken
- **Hallucination Guard**: If no source supports a claim, the system says "I don't have verified information on this" instead of guessing

### 3.5 Expert Collaboration Rooms (Multi-Expert Adversarial Reasoning)

A single expert can miss what it doesn't know. Collaboration Rooms bring multiple SME plugins into the same session to **debate, challenge each other, and synthesize** a consensus — catching cross-domain blind spots no single expert would find.

- **Room Creation**: Pick 2–5 expert plugins, name the room (e.g., "Building Safety Review Panel"), choose a deliberation mode
- **Three Deliberation Modes**:
  - **Debate** — experts challenge each other across multiple rounds, then converge on consensus
  - **Consensus** — all experts answer independently in one round, system synthesizes
  - **Review** — one expert answers first, others critique and refine
- **Live Streaming Deliberation**: Watch experts respond in real-time with color-coded lanes, revision markers, and citations from each expert's knowledge base
- **Consensus Synthesis**: After deliberation, an AI moderator synthesizes the final answer with agreement levels, conflict identification (resolved vs unresolved), and per-expert contribution summaries
- **Cross-Expert Revision Tracking**: When one expert revises their position based on another's input, it's visually highlighted — the structural engineer admits the fire safety expert found a blind spot
- **Combined Citations**: The consensus merges citations from all experts' knowledge bases, giving the most comprehensive source coverage possible
- **API + SDK Support**: `POST /api/v1/collaborate` for external agents, `lexic.collaborate()` in the SDK — same auth model as single-expert queries

---

## 5. Implementation TODOs (Hackathon)

### Phase 1: Foundation
- [x] Initialize Next.js + TypeScript + Tailwind
- [x] Add Clerk dependency
- [x] Add Drizzle Kit dependency
- [x] Install missing packages (drizzle-orm, postgres, ai, @ai-sdk/openai, @supabase/supabase-js, pdf-parse, zustand, zod, svix, shadcn/ui)
- [ ] Set up Supabase project (Postgres + Storage + pgvector extension)
- [x] Add all env vars to `.env` (DATABASE_URL, SUPABASE_*, OPENAI_API_KEY, ENCRYPTION_KEY)
- [x] Create `drizzle.config.ts`
- [x] Create Drizzle schema (`lib/db/schema.ts`) — users, plugins, knowledge_documents, knowledge_chunks, decision_trees, api_keys, query_logs
- [x] Create Drizzle client (`lib/db/index.ts`)
- [x] Run `drizzle-kit push` to create tables
- [x] Wrap `app/layout.tsx` with `<ClerkProvider>`
- [x] Create `middleware.ts` (Clerk middleware protecting dashboard routes)
- [x] Create Clerk auth pages (`sign-in/[[...sign-in]]`, `sign-up/[[...sign-up]]`)
- [x] Create `lib/auth.ts` with `requireUser()` helper (auto-creates DB user on first visit via `currentUser()` — no webhook needed)

### Phase 2: Core Engine
- [x] `lib/engine/embedding.ts` — Vercel AI SDK `embed()` + `embedMany()` wrapper using text-embedding-3-small
- [x] `lib/engine/chunker.ts` — text → chunks with metadata (1500-char chunks, 200-char overlap)
- [x] `lib/engine/retrieval.ts` — pgvector cosine similarity search (top-K=8, threshold=0.3)
- [x] `lib/engine/decision-tree.ts` — JSON tree executor (condition/question/action nodes)
- [x] `lib/engine/citation.ts` — parse [Source N] refs, map to documents, strip phantoms, compute confidence
- [x] `lib/engine/hallucination-guard.ts` — refuse when zero citations, self-refusal detected, or phantom majority
- [x] `lib/engine/query-pipeline.ts` — orchestrator (embed → retrieve → tree → LLM → cite → guard → log) with both `runQueryPipeline()` and `streamQueryPipeline()`
- [x] `/api/v1/query/route.ts` — **THE core endpoint** (API key auth, runs pipeline, supports both JSON and SSE streaming)
- [x] `lib/utils/api-key.ts` — key generation + hashing + AES-256-GCM encryption/decryption

### Phase 3: Web App UI
- [x] Install + configure shadcn/ui components (button, input, textarea, label, dialog, dropdown-menu, select, tabs, badge, sonner, silk)
- [x] Plugin list page (`/plugins`) — grid view with search, export as JSON
- [x] Plugin creation form (`/plugins/new`) — name, slug, domain, system prompt, citation mode
- [x] Knowledge base upload UI (`/plugins/[id]/knowledge`) — text paste + file upload, auto chunk+embed
- [x] Decision tree editor (`/plugins/[id]/trees`) — JSON editor with example template
- [x] Test sandbox (`/plugins/[id]/sandbox`) — streaming chat interface with citations + decision path + web search status
- [x] Plugin settings (`/plugins/[id]`) — edit, publish/unpublish toggle, share to marketplace, QR code
- [x] API key management page (`/api-keys`) — create, list, reveal (decrypted), revoke keys
- [x] Landing page (`/`) — value prop, feature grid, CTA
- [x] Documentation page (`/docs`) — full API reference, SDK guide, framework adapter examples

### Phase 4: SDK & Integration
- [x] Create `packages/sdk/` package structure (`lexic-sdk` npm package)
- [x] Core SDK — `Lexic` client with `query()`, `queryStream()`, `queryStreamToResult()`, `setActivePlugin()`; supports `context` (conversation history) and `options` (citationMode, maxSources, includeDecisionPath); all responses normalized with safe defaults
- [x] LangChain adapter (`LexicTool`) — returns JSON with full citation metadata
- [x] AutoGPT adapter (`LexicAutoGPT`) — returns human-readable text with citations and decision path
- [x] SDK test suite (69 unit tests covering normalization, adapters, error handling)
- [ ] Create 1 demo plugin: "Structural Engineering - IS 456" with knowledge base + decision tree
- [ ] End-to-end demo: LangChain agent using the demo plugin

### Phase 5: Marketplace & Polish
- [x] Marketplace browse page (`/marketplace`) — list plugins shared by creators, search/filter
- [x] Marketplace plugin detail page (`/marketplace/[slug]`) — plugin info + download
- [x] `/api/marketplace/[slug]/download` route — download shared plugin as JSON
- [x] Usage analytics dashboard (`/analytics`) — query volume, latency, confidence breakdown, top sources, decision path usage
- [ ] Error handling + loading states across all pages

### Phase 6: Expert Collaboration Rooms
- [x] Database schema — `collaboration_rooms` and `collaboration_sessions` tables with relations
- [x] `lib/engine/collaboration.ts` — multi-expert deliberation engine (resolve experts, per-expert RAG+decision tree, multi-round debate, consensus synthesis)
- [x] `POST /api/v1/collaborate` — external API endpoint (API key auth, JSON + SSE streaming)
- [x] `/api/collaboration-rooms` — dashboard CRUD (list, create rooms)
- [x] `/api/collaboration-rooms/[id]` — room detail + delete
- [x] `/api/collaboration-rooms/sandbox` — Clerk-auth streaming sandbox endpoint
- [x] SDK — `collaborate()` and `collaborateStream()` methods on `Lexic` client, new types (`CollaborateOptions`, `CollaborationResult`, `CollaborationStreamEvent`)
- [x] Dashboard UI — Collaboration Rooms list page (`/collaboration`)
- [x] Dashboard UI — Create Room page (`/collaboration/new`) — pick experts, mode, max rounds
- [x] Dashboard UI — Room sandbox (`/collaboration/[id]`) — live streaming deliberation view with color-coded expert lanes, revision markers, consensus panel with conflicts + contributions
- [x] Sidebar navigation — added "Collab Rooms" to dashboard nav
- [x] Middleware — protected `/collaboration` and `/api/collaboration-rooms` routes

### Stretch Goals
- [ ] Visual drag-and-drop decision tree editor
- [ ] Plugin ratings and reviews
- [ ] Confidence scoring display in UI
- [ ] Royalty/monetization system for plugin creators
- [ ] Supabase Storage integration for file uploads (scaffolding removed — currently using text paste + inline upload)

---

## 6. User Flows

### Flow 1: Expert Creates a Plugin
```
Sign Up → "Create New Plugin" → Name it ("Structural Engineering - IS 456")
→ Upload knowledge base (PDFs of IS 456, SP 16, ACI 318)
→ Define decision tree (load_type → beam_or_slab → check_depth → cite_table)
→ Set citation rules (mandatory, per-claim)
→ Test in sandbox → Publish v1.0 → Get API key + install snippet
```

### Flow 2: Developer Integrates a Plugin
There is no "install" step. The plugin lives on our servers. The developer just calls our API.

**Option A — Raw HTTP (any language, any framework):**
```
Sign up → Create API key on /api-keys page
→ POST /api/v1/query with { plugin: "structural-eng-v1", query: "..." }
→ Get back { answer, citations, decisionPath, confidence }
→ Hot-swap: same call, change "plugin" to "hvac-design-v1" → instant domain switch
```

**Option B — SDK (convenience wrapper, optional):**
```
npm install lexic-sdk
→ const lexic = new Lexic({ apiKey: "lx_xxx" })
→ lexic.query({ plugin: "structural-eng-v1", query: "..." })
```

**Option C — LangChain/AutoGPT tool (agent decides when to consult the expert):**
```
const tool = new LexicTool({ apiKey, plugin: "structural-eng-v1" })
→ Add to agent's tool list → agent autonomously calls expert when relevant
```

### Flow 3: Multi-Expert Collaboration
```
Dashboard → "Collab Rooms" → "New Room" → Name it ("Building Safety Review Panel")
→ Pick 3 plugins: Structural Engineering, Fire Safety, Building Code Compliance
→ Choose mode: Debate (3 rounds)
→ Ask: "Is a 6m cantilever RC beam safe for a commercial rooftop deck?"
→ Watch Round 1: Each expert answers from their knowledge base with citations
→ Watch Round 2: Structural Engineer revises (Building Code expert caught wrong load assumption)
   Fire Safety expert flags prestressed concrete needs different fire cover
→ Consensus synthesized: NOT safe as specified — recommends alternatives, full citations
→ Confidence: HIGH (3/3 experts aligned after revision)
```

**Via API:**
```
POST /api/v1/collaborate
{ experts: ["structural-eng", "fire-safety", "building-codes"], query: "...", mode: "debate" }
→ SSE stream: expert_thinking → expert_response → round_complete → ... → consensus
```

**Via SDK:**
```
const result = await lexic.collaborate({
  experts: ["structural-eng", "fire-safety", "building-codes"],
  query: "Is a 6m cantilever RC beam safe for a commercial rooftop deck?",
  mode: "debate",
  maxRounds: 3,
});
console.log(result.consensus.answer);  // Synthesized answer
console.log(result.consensus.conflicts); // Where experts disagreed
console.log(result.rounds); // Full deliberation transcript
```

### Flow 4: End User Gets Expert Answers
```
Opens their company's AI assistant → Asks "What's the minimum cover for a beam
exposed to weather per IS 456?"
→ Agent (with Lexic plugin) retrieves from knowledge base → Follows decision tree
→ Returns: "45mm nominal cover (IS 456:2000, Table 16, Clause 26.4.2)"
→ User clicks citation → sees the actual source text
```

---

## 7. Success Metrics

| Metric | Target |
|---|---|
| Plugin creation time | < 15 minutes for a basic domain |
| Integration time for developer | < 5 minutes (install + first query) |
| Citation coverage | > 90% of claims have source links |
| Hallucination rate (with plugin) | < 5% vs ~30% baseline |
| Demo day | 1 live plugin, 2 framework adapters, end-to-end flow |

---

## 8. Competitive Positioning

| Existing Approach | Limitation | Lexic Advantage |
|---|---|---|
| RAG (Retrieval Augmented Generation) | Retrieves text but no structured reasoning | We add decision trees + citation enforcement on top of retrieval |
| Fine-tuning | Expensive, not hot-swappable, no citations | We're runtime-injectable, version-controlled, source-linked |
| Custom GPTs (OpenAI) | Locked to OpenAI, no structured reasoning, weak citations | Framework-agnostic, decision tree logic, mandatory citations |
| LangChain Tools | Low-level, no marketplace, no domain packaging | We package the full expert: knowledge + reasoning + citations |
| CrewAI / AutoGen multi-agent | LLMs role-playing experts with no knowledge base backing | Our experts are **grounded** in real documents with citation enforcement — they catch each other's mistakes with evidence, not hallucinations |
| Single-expert RAG | One knowledge base, one perspective, blind to cross-domain gaps | Collaboration Rooms surface blind spots by having multiple grounded experts debate — the structural engineer catches the fire safety expert's oversight and vice versa |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Plugin quality varies | Rating system + mandatory test sandbox before publish |
| Citation accuracy (wrong source linked) | Chunk-level source tracking with similarity threshold |
| Decision tree complexity overwhelms creators | Start with JSON templates; visual editor is v2 |
| Framework adapter maintenance | Adapter interface is thin; community can contribute |
| Latency from citation + decision tree overhead | Async retrieval, edge caching of knowledge base embeddings |