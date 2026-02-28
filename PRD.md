# PRD: SME-Plug — Hot-Swappable Subject Matter Expert Plugin

## 1. Vision

**One-liner:** A plug-and-play platform where anyone can create, share, and inject domain-expert "brains" into any AI agent — turning a generalist chatbot into a verified specialist in seconds.

**Why this matters for real people:** Today, if a small manufacturer asks ChatGPT about ASME pressure vessel codes, or a clinic admin asks an AI about HIPAA billing edge-cases, the AI confidently guesses. SME-Plug kills hallucination by hot-swapping in a verified expert module — complete with decision trees, source-of-truth citations, and domain reasoning — so the answer is auditable, correct, and useful.

---

## 2. How It Works (Plain English)

SME-Plug is a **web platform + API**. It is NOT a CLI tool, not a library you import — it's a hosted service.

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

| Persona | Pain Today | SME-Plug Value |
|---|---|---|
| **Domain Expert / Consultant** | Knowledge trapped in their head or PDFs; can't scale themselves | Create an SME plugin once → it works 24/7 inside any AI agent, earns royalties |
| **AI Agent Builder / Developer** | Agents hallucinate on specialized tasks; building domain logic from scratch is expensive | Install a verified SME plugin in 3 lines of code; swap domains without retraining |
| **End Business User** (factory manager, clinic admin, compliance officer) | Needs expert-grade answers but can't afford a consultant for every question | Ask their AI agent domain questions and get cited, decision-tree-backed answers |

### Day-to-Day Use Cases

1. **Structural Engineering Firm** — Agent reviews uploaded drawings → SME plugin enforces IS 456 / ACI 318 checks → flags non-compliant beam sizes with citations.
2. **Healthcare Clinic** — Front-desk AI handles insurance queries → SME plugin injects CPT/ICD coding decision trees → answers with CMS source links.
3. **E-commerce Seller** — AI agent handles customer returns → SME plugin for "Consumer Protection Act" ensures legally correct responses.
4. **Legal Freelancer** — Contract review agent → SME plugin for Indian Contract Act → highlights risky clauses with section references.
5. **Agri-tech Startup** — Farmer chatbot → SME plugin for crop disease diagnosis → follows ICAR decision tree → cites published advisories.

---

## 4. Product Features (MVP — Hackathon Scope)

### 3.1 SME Plugin Builder (Web App)

- **Knowledge Base Upload**: Upload PDFs, markdown, URLs, or structured JSON as the domain's "Source of Truth"
- **Decision Tree Editor**: Visual node-based editor to create domain reasoning flows (if → then → else chains)
- **System Prompt Composer**: Auto-generates the expert persona prompt ("Think like a Structural Engineer") with injected constraints
- **Citation Rules**: Define mandatory citation patterns — every claim must link back to an uploaded source
- **Test Sandbox**: Chat with your plugin in-browser before publishing to verify behavior
- **Publish & Version**: One-click publish with semantic versioning; consumers pin to a version

### 3.2 Plugin Marketplace / Registry

- **Browse & Search**: Filter plugins by domain, rating, framework compatibility
- **Install via API key or SDK**: `sme.install("structural-engineering-v2")` — 1 line
- **Ratings & Reviews**: Users rate plugin accuracy
- **Usage Analytics Dashboard**: Plugin creators see install count, query volume, accuracy feedback

### 3.3 Universal Agent Integration Layer

- **Framework Adapters**: Pre-built adapters for LangChain, AutoGPT, CrewAI, OpenAI Assistants API, Vercel AI SDK
- **REST API**: For any custom agent — POST the user query + plugin ID → get expert-augmented response
- **Hot-Swap at Runtime**: Switch the active SME plugin mid-conversation without restart
- **Multi-Plugin Stacking**: Combine plugins (e.g., "Structural Engineering" + "Indian Building Codes") with conflict resolution

### 3.4 Citation & Audit Engine

- **Inline Citations**: Every response chunk tagged with `[Source: document_name, page X, section Y]`
- **Confidence Scoring**: Each answer gets a confidence level (High / Medium / Low) based on source coverage
- **Audit Log**: Full trace of which decision tree nodes fired, which sources were retrieved, what reasoning path was taken
- **Hallucination Guard**: If no source supports a claim, the system says "I don't have verified information on this" instead of guessing

---

## 5. Implementation TODOs (Hackathon)

### Phase 1: Foundation
- [x] Initialize Next.js + TypeScript + Tailwind
- [x] Add Clerk dependency
- [x] Add Drizzle Kit dependency
- [ ] Install missing packages (drizzle-orm, postgres, openai, @supabase/supabase-js, pdf-parse, zustand, zod, svix, shadcn/ui)
- [ ] Set up Supabase project (Postgres + Storage + pgvector extension)
- [ ] Add all env vars to `.env` (DATABASE_URL, SUPABASE_*, OPENAI_API_KEY, CLERK_WEBHOOK_SECRET)
- [ ] Create `drizzle.config.ts`
- [ ] Create Drizzle schema (`src/lib/db/schema.ts`) — users, plugins, knowledge_documents, knowledge_chunks, decision_trees, api_keys, query_logs
- [ ] Create Drizzle client (`src/lib/db/index.ts`)
- [ ] Run `drizzle-kit push` to create tables
- [ ] Run custom migration for pgvector extension + IVFFlat index
- [ ] Wrap `app/layout.tsx` with `<ClerkProvider>`
- [ ] Create `middleware.ts` (Clerk authMiddleware protecting dashboard routes)
- [ ] Create Clerk auth pages (`sign-in/[[...sign-in]]`, `sign-up/[[...sign-up]]`)
- [ ] Create Clerk webhook endpoint (`/api/webhooks/clerk/route.ts`) for user sync
- [ ] Create `lib/auth.ts` with `requireUser()` helper

### Phase 2: Core Engine
- [ ] `lib/engine/embedding.ts` — OpenAI text-embedding-3-small wrapper
- [ ] `lib/engine/chunker.ts` — PDF/markdown text → chunks with metadata
- [ ] `lib/utils/pdf-parser.ts` — PDF text extraction via pdf-parse
- [ ] `lib/engine/retrieval.ts` — pgvector cosine similarity search (top-K, threshold)
- [ ] `lib/engine/decision-tree.ts` — JSON tree executor (condition/question/action nodes)
- [ ] `lib/engine/citation.ts` — parse [Source N] refs, map to documents, compute confidence
- [ ] `lib/engine/hallucination-guard.ts` — refuse when confidence = low
- [ ] `lib/engine/query-pipeline.ts` — orchestrator (embed → retrieve → tree → LLM → cite → log)
- [ ] `/api/v1/query/route.ts` — **THE core endpoint** (API key auth, runs pipeline, returns cited response)
- [ ] `lib/utils/api-key.ts` — key generation + hashing

### Phase 3: Web App UI
- [ ] Install + configure shadcn/ui components
- [ ] Plugin list page (`/plugins`)
- [ ] Plugin creation form (`/plugins/new`) — name, domain, system prompt, citation mode
- [ ] Knowledge base upload UI (`/plugins/[id]/knowledge`) — drag-and-drop PDFs, trigger chunk+embed
- [ ] Decision tree editor (`/plugins/[id]/trees`) — JSON editor + visual preview
- [ ] Test sandbox (`/plugins/[id]/sandbox`) — chat interface hitting query API
- [ ] Plugin publish flow (`/plugins/[id]` → publish button)
- [ ] API key management page (`/api-keys`) — create, list, revoke keys
- [ ] Landing page (`/`) — value prop, CTAs, use case examples

### Phase 4: SDK & Integration
- [ ] Create `packages/sdk/` package structure
- [ ] `@sme-plug/sdk` core — `SMEPlug` client with `query()` + `setActivePlugin()`
- [ ] LangChain adapter (`SMEPlugTool`)
- [ ] AutoGPT adapter
- [ ] Create 1 demo plugin: "Structural Engineering - IS 456" with knowledge base + decision tree
- [ ] End-to-end demo: LangChain agent using the demo plugin

### Phase 5: Marketplace & Polish
- [ ] Marketplace browse page (`/marketplace`) — list published plugins
- [ ] Marketplace plugin detail page (`/marketplace/[slug]`)
- [ ] `/api/marketplace` routes (public, no auth required)
- [ ] Usage analytics dashboard (`/analytics`)
- [ ] Error handling + loading states across all pages
- [ ] Deploy to Vercel

### Stretch Goals
- [ ] Visual drag-and-drop decision tree editor
- [ ] Plugin ratings and reviews
- [ ] Multi-plugin stacking with conflict resolution
- [ ] Confidence scoring display in UI
- [ ] CrewAI + Vercel AI SDK adapters
- [ ] Royalty/monetization system for plugin creators

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
npm install @sme-plug/sdk
→ const sme = new SMEPlug({ apiKey: "sme_xxx" })
→ sme.query({ plugin: "structural-eng-v1", query: "..." })
```

**Option C — LangChain/AutoGPT tool (agent decides when to consult the expert):**
```
const tool = new SMEPlugTool({ apiKey, plugin: "structural-eng-v1" })
→ Add to agent's tool list → agent autonomously calls expert when relevant
```

### Flow 3: End User Gets Expert Answers
```
Opens their company's AI assistant → Asks "What's the minimum cover for a beam
exposed to weather per IS 456?"
→ Agent (with SME plugin) retrieves from knowledge base → Follows decision tree
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

| Existing Approach | Limitation | SME-Plug Advantage |
|---|---|---|
| RAG (Retrieval Augmented Generation) | Retrieves text but no structured reasoning | We add decision trees + citation enforcement on top of retrieval |
| Fine-tuning | Expensive, not hot-swappable, no citations | We're runtime-injectable, version-controlled, source-linked |
| Custom GPTs (OpenAI) | Locked to OpenAI, no structured reasoning, weak citations | Framework-agnostic, decision tree logic, mandatory citations |
| LangChain Tools | Low-level, no marketplace, no domain packaging | We package the full expert: knowledge + reasoning + citations |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Plugin quality varies | Rating system + mandatory test sandbox before publish |
| Citation accuracy (wrong source linked) | Chunk-level source tracking with similarity threshold |
| Decision tree complexity overwhelms creators | Start with JSON templates; visual editor is v2 |
| Framework adapter maintenance | Adapter interface is thin; community can contribute |
| Latency from citation + decision tree overhead | Async retrieval, edge caching of knowledge base embeddings |