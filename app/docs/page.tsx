"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FlaskConical,
  ArrowRight,
  Copy,
  Check,
  Key,
  Plug,
  FileText,
  GitBranch,
  Zap,
  Terminal,
  BookOpen,
  Code2,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute right-3 top-3 rounded-md border border-[#333] bg-[#1a1a1a] p-1.5 text-[#666] transition-colors hover:border-[#444] hover:text-[#999]"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-[#262626] bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-widest text-[#444]">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="text-[#b0b0b0]">{code}</code>
      </pre>
    </div>
  );
}

function ParamRow({
  name,
  type,
  required,
  description,
}: {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}) {
  return (
    <tr className="border-b border-[#1a1a1a] last:border-0">
      <td className="py-3 pr-4 align-top">
        <code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[13px] text-emerald-400">{name}</code>
      </td>
      <td className="py-3 pr-4 align-top">
        <span className="text-[13px] text-[#888]">{type}</span>
      </td>
      <td className="py-3 pr-4 align-top">
        {required ? (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Required</span>
        ) : (
          <span className="text-[11px] uppercase tracking-wider text-[#555]">Optional</span>
        )}
      </td>
      <td className="py-3 align-top text-[13px] text-[#999]">{description}</td>
    </tr>
  );
}

function StatusBadge({ code, color }: { code: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    yellow: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${colorMap[color]}`}>
      {code}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    POST: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    PUT: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    PATCH: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    DELETE: "border-red-500/30 bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${colors[method]}`}>
      {method}
    </span>
  );
}

const sections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "authentication", label: "Authentication", icon: Key },
  { id: "query", label: "Query Endpoint", icon: Zap },
  { id: "plugins", label: "Plugins", icon: Plug },
  { id: "documents", label: "Knowledge Docs", icon: FileText },
  { id: "trees", label: "Decision Trees", icon: GitBranch },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "sandbox", label: "Sandbox", icon: Terminal },
  { id: "sdk", label: "SDK Reference", icon: Code2 },
  { id: "langchain", label: "LangChain", icon: ExternalLink },
  { id: "autogpt", label: "AutoGPT", icon: ExternalLink },
  { id: "errors", label: "Errors", icon: Search },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[#262626] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-white">
            <FlaskConical className="h-5 w-5" />
            Lexic
          </Link>
          <div className="flex items-center gap-4">
            <span className="rounded-full border border-[#262626] bg-[#111] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#666]">
              Documentation
            </span>
            <Button size="sm" className="bg-white text-black hover:bg-[#ccc] font-semibold" asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1">
        {/* Sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-[#262626] p-4 lg:block">
          <nav className="space-y-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
                  activeSection === s.id
                    ? "bg-[#1a1a1a] text-white font-medium"
                    : "text-[#777] hover:bg-[#111] hover:text-[#bbb]"
                }`}
              >
                <s.icon className="h-3.5 w-3.5 shrink-0" />
                {s.label}
              </a>
            ))}
          </nav>

          <div className="mt-8 rounded-md border border-[#262626] bg-[#111] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#555]">Install SDK</p>
            <div className="mt-2 rounded bg-[#0a0a0a] px-3 py-2">
              <code className="text-[12px] text-emerald-400">npm i @lexic-app/sdk</code>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-6 py-10 lg:px-12">
          <div className="mx-auto max-w-3xl">

            {/* ── Overview ── */}
            <section id="overview" className="scroll-mt-20">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">Lexic HDK</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white">API Reference</h1>
              <p className="mt-4 text-[15px] leading-relaxed text-[#999]">
                The Lexic API enables you to integrate subject matter expert plugins into any AI agent.
                Every response is backed by source citations, decision-tree reasoning, and a hallucination guard.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-[#262626] bg-[#111] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#555]">Base URL</p>
                  <code className="mt-1.5 block text-[14px] text-white">https://dawk-ps2.vercel.app</code>
                </div>
                <div className="rounded-md border border-[#262626] bg-[#111] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#555]">SDK Package</p>
                  <code className="mt-1.5 block text-[14px] text-white">@lexic-app/sdk</code>
                </div>
              </div>

              <div className="mt-6 rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[13px] leading-relaxed text-amber-300/90">
                  <strong className="text-amber-300">Two auth modes:</strong> Dashboard routes use Clerk JWT sessions.
                  The <code className="rounded bg-amber-500/10 px-1 text-[12px]">/api/v1/query</code> endpoint uses Bearer token API key auth for external agent integrations.
                </p>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── Authentication ── */}
            <section id="authentication" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">Authentication</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                The main query endpoint authenticates via API key sent as a Bearer token.
                Generate keys from the <Link href="/api-keys" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">API Keys</Link> page in the dashboard.
              </p>

              <CodeBlock
                language="http"
                code={`Authorization: Bearer lx_a1b2c3d4e5f6...`}
              />

              <p className="mt-4 text-[13px] text-[#777]">
                All other <code className="text-[#bbb]">/api/*</code> endpoints (plugins, documents, trees, api-keys) require a Clerk session cookie — they are for the web dashboard, not for external agent calls.
              </p>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── Query Endpoint ── */}
            <section id="query" className="scroll-mt-20">
              <div className="flex items-center gap-3">
                <MethodBadge method="POST" />
                <h2 className="text-2xl font-bold text-white">/api/v1/query</h2>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                The core endpoint. Send a question and a plugin slug, and get back a cited, decision-tree-backed expert answer. This is the only endpoint external agents need.
              </p>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Request Body</h3>
              <div className="overflow-x-auto rounded-md border border-[#262626]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#262626] bg-[#111]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Param</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Type</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Required</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    <ParamRow name="plugin" type="string" required description="Slug of the expert plugin to query (e.g. &quot;structural-eng-v1&quot;)" />
                    <ParamRow name="query" type="string" required description="The domain question to ask. Max 4,000 characters." />
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Example Request</h3>
              <CodeBlock
                language="bash"
                code={`curl -X POST https://dawk-ps2.vercel.app/api/v1/query \\
  -H "Authorization: Bearer lx_a1b2c3d4..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "plugin": "structural-eng-v1",
    "query": "What is the minimum cover for a beam in severe exposure?"
  }'`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Response</h3>
              <CodeBlock
                language="json"
                code={`{
  "answer": "According to IS 456 Table 16, the minimum nominal cover for a beam in severe exposure is 45mm. [Source 1]",
  "citations": [
    {
      "id": "chunk_abc123",
      "document": "IS-456-2000.pdf",
      "page": 34,
      "section": "Table 16 — Nominal Cover",
      "excerpt": "For severe exposure conditions, beams require 45mm minimum cover..."
    }
  ],
  "decisionPath": [
    { "step": 1, "node": "q1", "label": "Member Type", "value": "beam" },
    { "step": 2, "node": "q2", "label": "Exposure Class", "value": "severe" },
    { "step": 3, "node": "a1", "label": "Cover Recommendation", "result": "45mm nominal cover" }
  ],
  "confidence": "high",
  "pluginVersion": "1"
}`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Response Fields</h3>
              <div className="overflow-x-auto rounded-md border border-[#262626]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#262626] bg-[#111]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Field</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Type</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    <tr className="border-b border-[#1a1a1a]">
                      <td className="px-4 py-3"><code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[13px] text-emerald-400">answer</code></td>
                      <td className="px-4 py-3 text-[13px] text-[#888]">string</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">The expert answer with inline [Source N] citations</td>
                    </tr>
                    <tr className="border-b border-[#1a1a1a]">
                      <td className="px-4 py-3"><code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[13px] text-emerald-400">citations</code></td>
                      <td className="px-4 py-3 text-[13px] text-[#888]">Citation[]</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Array of source references with document, page, section, and excerpt</td>
                    </tr>
                    <tr className="border-b border-[#1a1a1a]">
                      <td className="px-4 py-3"><code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[13px] text-emerald-400">decisionPath</code></td>
                      <td className="px-4 py-3 text-[13px] text-[#888]">DecisionStep[]</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Steps the decision tree walked to reach the answer</td>
                    </tr>
                    <tr className="border-b border-[#1a1a1a]">
                      <td className="px-4 py-3"><code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[13px] text-emerald-400">confidence</code></td>
                      <td className="px-4 py-3 text-[13px] text-[#888]">&quot;high&quot; | &quot;medium&quot; | &quot;low&quot;</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Hallucination guard score. Low = answer was refused/replaced.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[13px] text-emerald-400">pluginVersion</code></td>
                      <td className="px-4 py-3 text-[13px] text-[#888]">string</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Plugin version at time of query (for audit trails)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Error Responses</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-2.5">
                  <StatusBadge code={401} color="red" />
                  <span className="text-[13px] text-[#999]">Missing or invalid API key</span>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-2.5">
                  <StatusBadge code={400} color="yellow" />
                  <span className="text-[13px] text-[#999]">Missing <code className="text-[#bbb]">plugin</code> or <code className="text-[#bbb]">query</code>, or query exceeds 4,000 chars</span>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-2.5">
                  <StatusBadge code={404} color="blue" />
                  <span className="text-[13px] text-[#999]">Plugin not found or access denied (not published and not owned by key holder)</span>
                </div>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── Plugins ── */}
            <section id="plugins" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">Plugins</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                CRUD endpoints for managing expert plugins. All require Clerk session auth (dashboard use only).
              </p>

              {/* GET /api/plugins */}
              <div className="mt-8 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="GET" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">List all plugins owned by the authenticated user, ordered by creation date (newest first).</p>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Response</h4>
                <p className="mt-1 text-[13px] text-[#777]">Array of plugin objects with all fields (id, name, slug, domain, description, systemPrompt, citationMode, version, isPublished, config, createdAt, updatedAt).</p>
              </div>

              {/* POST /api/plugins */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="POST" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Create a new expert plugin. A unique slug is auto-generated from the name.</p>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Request Body</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <ParamRow name="name" type="string" required description="Display name of the plugin" />
                      <ParamRow name="domain" type="string" required description="Domain/field of expertise (e.g. &quot;Structural Engineering&quot;)" />
                      <ParamRow name="systemPrompt" type="string" required description="Expert persona prompt for the LLM" />
                      <ParamRow name="description" type="string" description="Optional description of the plugin" />
                      <ParamRow name="citationMode" type="string" description='Citation mode: &quot;mandatory&quot; (default) or &quot;optional&quot;' />
                    </tbody>
                  </table>
                </div>
                <CodeBlock
                  language="json"
                  code={`{
  "name": "Structural Engineering Expert",
  "domain": "Structural Engineering",
  "systemPrompt": "You are an expert structural engineer specializing in IS 456 code compliance...",
  "description": "Expert on IS 456 concrete design standards",
  "citationMode": "mandatory"
}`}
                />
              </div>

              {/* GET /api/plugins/:id */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="GET" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Get a single plugin by UUID, including its related knowledge documents and decision trees. Must be the plugin owner.</p>
              </div>

              {/* PUT /api/plugins/:id */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="PUT" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Update a plugin. Supports partial updates — only send the fields you want to change.</p>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Updatable Fields</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <ParamRow name="name" type="string" description="New display name" />
                      <ParamRow name="description" type="string" description="New description" />
                      <ParamRow name="domain" type="string" description="New domain" />
                      <ParamRow name="systemPrompt" type="string" description="New system prompt" />
                      <ParamRow name="citationMode" type="string" description='&quot;mandatory&quot; or &quot;optional&quot;' />
                      <ParamRow name="isPublished" type="boolean" description="Publish/unpublish the plugin" />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DELETE /api/plugins/:id */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="DELETE" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Delete a plugin and all associated data (documents, chunks, decision trees) via cascade. Must be the plugin owner.</p>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── Knowledge Documents ── */}
            <section id="documents" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">Knowledge Documents</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                Upload reference documents to a plugin&apos;s knowledge base. Documents are automatically chunked and embedded for vector similarity search.
              </p>

              {/* GET */}
              <div className="mt-8 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="GET" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id/documents</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">List all knowledge documents for a plugin. Requires ownership.</p>
              </div>

              {/* POST */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="POST" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id/documents</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">
                  Upload a document. Accepts <code className="text-[#bbb]">multipart/form-data</code>.
                  The document is chunked, embedded with OpenAI text-embedding-3-small (1536 dimensions), and stored for pgvector retrieval.
                </p>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Form Fields</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <ParamRow name="file" type="File" description="A PDF, markdown, or text file to upload" />
                      <ParamRow name="text" type="string" description="Alternatively, send raw text content directly" />
                      <ParamRow name="fileName" type="string" description="Override the file name (defaults to uploaded file name)" />
                      <ParamRow name="fileType" type="string" description='Document type: &quot;pdf&quot;, &quot;markdown&quot;, etc. (defaults to &quot;markdown&quot;)' />
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[13px] text-[#777]">Either <code className="text-[#bbb]">file</code> or <code className="text-[#bbb]">text</code> must be provided.</p>

                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Response (201)</h4>
                <CodeBlock
                  language="json"
                  code={`{
  "id": "doc_uuid",
  "pluginId": "plugin_uuid",
  "fileName": "IS-456-2000.pdf",
  "fileType": "pdf",
  "rawText": "...",
  "metadata": null,
  "createdAt": "2026-02-28T...",
  "chunksCreated": 42
}`}
                />
              </div>

              {/* DELETE */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="DELETE" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id/documents?docId=...</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Delete a document and all its chunks (cascade). Requires <code className="text-[#bbb]">docId</code> query param.</p>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── Decision Trees ── */}
            <section id="trees" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">Decision Trees</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                Decision trees add structured reasoning on top of RAG retrieval. Define condition/question/action nodes as JSON, and the engine walks the tree during each query.
              </p>

              {/* GET */}
              <div className="mt-8 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="GET" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id/trees</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">List all decision trees for a plugin.</p>
              </div>

              {/* POST */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="POST" />
                  <code className="text-[14px] font-semibold text-white">/api/plugins/:id/trees</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Create a new decision tree for the plugin.</p>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Request Body</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <ParamRow name="name" type="string" required description="Name of the decision tree" />
                      <ParamRow name="treeData" type="object" required description="JSON decision graph (see structure below)" />
                      <ParamRow name="description" type="string" description="Optional description" />
                    </tbody>
                  </table>
                </div>

                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Tree Data Structure</h4>
                <CodeBlock
                  language="json"
                  code={`{
  "rootNode": "q1",
  "nodes": {
    "q1": {
      "type": "question",
      "label": "Member Type",
      "param": "member_type",
      "branches": {
        "beam": "q2",
        "column": "q3"
      }
    },
    "q2": {
      "type": "question",
      "label": "Exposure Class",
      "param": "exposure",
      "branches": {
        "mild": "a1",
        "severe": "a2"
      }
    },
    "a1": {
      "type": "action",
      "label": "Cover Recommendation",
      "recommendation": "20mm nominal cover"
    },
    "a2": {
      "type": "action",
      "label": "Cover Recommendation",
      "recommendation": "45mm nominal cover"
    }
  }
}`}
                />
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── API Keys ── */}
            <section id="api-keys" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">API Keys</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                Manage API keys for authenticating external agent calls. Keys are prefixed with <code className="text-[#bbb]">lx_</code> and stored as salted hashes. All endpoints require Clerk session auth.
              </p>

              {/* GET */}
              <div className="mt-8 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="GET" />
                  <code className="text-[14px] font-semibold text-white">/api/api-keys</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">List all API keys for the authenticated user. Returns id, name, key prefix (first 8 chars), last used timestamp, and created timestamp. Never returns the full key.</p>
              </div>

              {/* POST */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="POST" />
                  <code className="text-[14px] font-semibold text-white">/api/api-keys</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Generate a new API key. The full key is returned <strong className="text-white">only once</strong> in the response — store it securely.</p>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Request Body</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <ParamRow name="name" type="string" required description="A label for this key (e.g. &quot;production&quot;, &quot;my-agent&quot;)" />
                    </tbody>
                  </table>
                </div>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Response (201)</h4>
                <CodeBlock
                  language="json"
                  code={`{
  "key": "lx_a1b2c3d4e5f6g7h8i9j0...",
  "prefix": "lx_a1b2c",
  "name": "production"
}`}
                />
              </div>

              {/* PATCH */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="PATCH" />
                  <code className="text-[14px] font-semibold text-white">/api/api-keys</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Decrypt and reveal the full API key (requires ownership). Body: <code className="text-[#bbb]">{`{ "id": "key_uuid" }`}</code></p>
              </div>

              {/* DELETE */}
              <div className="mt-4 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="DELETE" />
                  <code className="text-[14px] font-semibold text-white">/api/api-keys?id=...</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Delete an API key. Detaches it from query logs before removal. Requires <code className="text-[#bbb]">id</code> query param.</p>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── Sandbox ── */}
            <section id="sandbox" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">Sandbox</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                Test your plugin&apos;s query pipeline without publishing. Uses Clerk session auth — available from the dashboard only.
              </p>

              <div className="mt-8 rounded-md border border-[#262626] bg-[#111] p-5">
                <div className="flex items-center gap-3">
                  <MethodBadge method="POST" />
                  <code className="text-[14px] font-semibold text-white">/api/sandbox/:pluginId</code>
                </div>
                <p className="mt-3 text-[13px] text-[#999]">Run a test query against an unpublished (or published) plugin you own. Same pipeline as the production query endpoint, but bypasses the publish check.</p>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Request Body</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody>
                      <ParamRow name="query" type="string" required description="The question to test" />
                    </tbody>
                  </table>
                </div>
                <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Response</h4>
                <p className="mt-1 text-[13px] text-[#777]">Same shape as <code className="text-[#bbb]">/api/v1/query</code> — answer, citations, confidence, decisionPath.</p>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── SDK Reference ── */}
            <section id="sdk" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">SDK Reference</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                The TypeScript SDK wraps the REST API with type-safe methods, timeout handling, and framework adapters.
              </p>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Installation</h3>
              <CodeBlock language="bash" code="npm install @lexic-app/sdk" />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Quick Start</h3>
              <CodeBlock
                language="typescript"
                code={`import { Lexic } from "@lexic-app/sdk";

const lexic = new Lexic({
  apiKey: "lx_your_api_key",
  defaultPlugin: "structural-eng-v1",
});

const result = await lexic.query({
  query: "Minimum cover for a beam in severe exposure?",
});

console.log(result.answer);       // Cited expert answer
console.log(result.citations);    // Source references
console.log(result.confidence);   // "high" | "medium" | "low"
console.log(result.decisionPath); // Decision tree steps`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Constructor: <code className="normal-case text-white">new Lexic(config)</code></h3>
              <div className="overflow-x-auto rounded-md border border-[#262626]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#262626] bg-[#111]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Param</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Type</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Required</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    <ParamRow name="apiKey" type="string" required description="Your Lexic API key (starts with lx_)" />
                    <ParamRow name="baseUrl" type="string" description='Override the API base URL. Default: "https://dawk-ps2.vercel.app"' />
                    <ParamRow name="defaultPlugin" type="string" description="Default plugin slug for all queries" />
                    <ParamRow name="timeout" type="number" description="Request timeout in ms. Default: 30000" />
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Methods</h3>

              <div className="space-y-4">
                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">query(options): Promise&lt;QueryResult&gt;</code>
                  <p className="mt-2 text-[13px] text-[#999]">Send a question to an expert plugin. If no <code className="text-[#bbb]">plugin</code> is given in options, uses the active plugin.</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left">
                      <tbody>
                        <ParamRow name="options.plugin" type="string" description="Plugin slug (overrides activePlugin for this call)" />
                        <ParamRow name="options.query" type="string" required description="The domain question" />
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">setActivePlugin(slug): void</code>
                  <p className="mt-2 text-[13px] text-[#999]">Hot-swap the active plugin. All subsequent <code className="text-[#bbb]">query()</code> calls will use this plugin unless overridden.</p>
                </div>

                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">getActivePlugin(): string | null</code>
                  <p className="mt-2 text-[13px] text-[#999]">Returns the currently active plugin slug, or null if none is set.</p>
                </div>
              </div>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Hot-Swap Example</h3>
              <CodeBlock
                language="typescript"
                code={`const lexic = new Lexic({ apiKey: "lx_..." });

// Query the structural engineering expert
lexic.setActivePlugin("structural-eng-v1");
const structResult = await lexic.query({
  query: "Max allowable deflection for a cantilever?",
});

// Instantly switch to a different domain expert
lexic.setActivePlugin("electrical-code-v2");
const elecResult = await lexic.query({
  query: "Wire sizing for a 30A circuit?",
});`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">TypeScript Types</h3>
              <CodeBlock
                language="typescript"
                code={`interface LexicConfig {
  apiKey: string;
  baseUrl?: string;
  defaultPlugin?: string;
  timeout?: number;
}

interface QueryOptions {
  plugin?: string;
  query: string;
}

interface QueryResult {
  answer: string;
  citations: Citation[];
  decisionPath: DecisionStep[];
  confidence: "high" | "medium" | "low";
  pluginVersion: string;
}

interface Citation {
  id: string;
  document: string;
  page?: number;
  section?: string;
  excerpt: string;
}

interface DecisionStep {
  step: number;
  node: string;
  label: string;
  value?: string;
  result?: string;
}`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Error Handling</h3>
              <CodeBlock
                language="typescript"
                code={`import { Lexic, LexicAPIError } from "@lexic-app/sdk";

try {
  const result = await lexic.query({ query: "..." });
} catch (err) {
  if (err instanceof LexicAPIError) {
    console.error(err.message); // "Plugin not found or access denied"
    console.error(err.status);  // 404
  }
}`}
              />
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── LangChain ── */}
            <section id="langchain" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">LangChain Adapter</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                Drop Lexic into any LangChain agent as a tool. Zero-dependency wrapper — doesn&apos;t require <code className="text-[#bbb]">langchain</code> as a peer dependency.
              </p>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Installation</h3>
              <CodeBlock language="bash" code="npm install @lexic-app/sdk" />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Usage</h3>
              <CodeBlock
                language="typescript"
                code={`import { LexicTool } from "@lexic-app/sdk/langchain";

const tool = new LexicTool({
  apiKey: "lx_your_api_key",
  plugin: "structural-eng-v1",
  name: "structural_expert",        // optional
  description: "Consult a structural engineering expert", // optional
});

// Add to any LangChain agent
const agent = createOpenAIToolsAgent({
  llm,
  tools: [tool],
  prompt,
});

// Hot-swap to a different expert
tool.setPlugin("electrical-code-v2");`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Constructor: <code className="normal-case text-white">new LexicTool(config)</code></h3>
              <div className="overflow-x-auto rounded-md border border-[#262626]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#262626] bg-[#111]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Param</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Type</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Required</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    <ParamRow name="apiKey" type="string" required description="Lexic API key" />
                    <ParamRow name="plugin" type="string" required description="Plugin slug to query" />
                    <ParamRow name="baseUrl" type="string" description="Override API base URL" />
                    <ParamRow name="name" type="string" description='LangChain tool name. Default: "lexic_{slug}"' />
                    <ParamRow name="description" type="string" description="LangChain tool description shown to the LLM" />
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Methods</h3>
              <div className="space-y-4">
                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">call(input: string): Promise&lt;string&gt;</code>
                  <p className="mt-2 text-[13px] text-[#999]">LangChain Tool interface. Takes the agent&apos;s string input, queries the plugin, and returns a JSON string with answer, citations, confidence, and decision path.</p>
                </div>
                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">setPlugin(slug: string): void</code>
                  <p className="mt-2 text-[13px] text-[#999]">Hot-swap which plugin this tool queries.</p>
                </div>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── AutoGPT ── */}
            <section id="autogpt" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">AutoGPT Adapter</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                Register Lexic as an AutoGPT command with typed parameters and execution.
              </p>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Usage</h3>
              <CodeBlock
                language="typescript"
                code={`import { LexicAutoGPT } from "@lexic-app/sdk/autogpt";

const adapter = new LexicAutoGPT({
  apiKey: "lx_your_api_key",
  plugin: "structural-eng-v1",
  commandName: "consult_structural_expert",     // optional
  commandDescription: "Ask the structural expert", // optional
});

// Register as an AutoGPT command
const command = adapter.asCommand();
// command.name, command.description, command.parameters, command.execute

// Or execute directly
const answer = await adapter.execute(
  "What is the minimum reinforcement ratio for a slab?"
);`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Constructor: <code className="normal-case text-white">new LexicAutoGPT(config)</code></h3>
              <div className="overflow-x-auto rounded-md border border-[#262626]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#262626] bg-[#111]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Param</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Type</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Required</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    <ParamRow name="apiKey" type="string" required description="Lexic API key" />
                    <ParamRow name="plugin" type="string" required description="Plugin slug to query" />
                    <ParamRow name="baseUrl" type="string" description="Override API base URL" />
                    <ParamRow name="commandName" type="string" description='AutoGPT command name. Default: "consult_{slug}"' />
                    <ParamRow name="commandDescription" type="string" description="Command description for the agent" />
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Methods</h3>
              <div className="space-y-4">
                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">asCommand(): AutoGPTCommand</code>
                  <p className="mt-2 text-[13px] text-[#999]">Returns an object with <code className="text-[#bbb]">name</code>, <code className="text-[#bbb]">description</code>, <code className="text-[#bbb]">parameters</code>, and <code className="text-[#bbb]">execute</code> — ready to register with AutoGPT.</p>
                </div>
                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">execute(query: string): Promise&lt;string&gt;</code>
                  <p className="mt-2 text-[13px] text-[#999]">Execute a query directly. Returns a human-readable string with the answer, citations, and decision path.</p>
                </div>
                <div className="rounded-md border border-[#262626] bg-[#111] p-5">
                  <code className="text-[14px] font-semibold text-white">setPlugin(slug: string): void</code>
                  <p className="mt-2 text-[13px] text-[#999]">Hot-swap which plugin this adapter queries.</p>
                </div>
              </div>
            </section>

            <hr className="my-14 border-[#1a1a1a]" />

            {/* ── Errors ── */}
            <section id="errors" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-white">Error Reference</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[#999]">
                All error responses follow the same shape. The SDK throws <code className="text-[#bbb]">LexicAPIError</code> with a <code className="text-[#bbb]">status</code> property.
              </p>

              <CodeBlock
                language="json"
                code={`{
  "error": "Human-readable error message"
}`}
              />

              <h3 className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-widest text-[#555]">Status Codes</h3>
              <div className="overflow-x-auto rounded-md border border-[#262626]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#262626] bg-[#111]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Code</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">Meaning</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#555]">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={200} color="green" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">OK</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Successful request</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={201} color="green" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">Created</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Resource successfully created (plugin, document, key, tree)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={400} color="yellow" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">Bad Request</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Missing required fields, invalid JSON, or query too long</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={401} color="red" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">Unauthorized</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Missing/invalid API key or Clerk session</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={403} color="red" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">Forbidden</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Plugin not published (for query endpoint)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={404} color="blue" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">Not Found</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Plugin, document, or API key not found</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={408} color="yellow" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">Timeout</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">SDK request exceeded timeout (default 30s)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><StatusBadge code={500} color="red" /></td>
                      <td className="px-4 py-3 text-[13px] text-white">Server Error</td>
                      <td className="px-4 py-3 text-[13px] text-[#999]">Internal error (LLM failure, database error, etc.)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Footer CTA */}
            <div className="mt-20 rounded-md border border-[#262626] bg-[#111] p-8 text-center">
              <h3 className="text-xl font-bold text-white">Ready to integrate?</h3>
              <p className="mt-2 text-[14px] text-[#999]">Create your first plugin and start querying in under 5 minutes.</p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button className="bg-white text-black hover:bg-[#ccc] font-semibold" asChild>
                  <Link href="/sign-up">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="border-[#333] text-[#ededed] hover:bg-[#1a1a1a]" asChild>
                  <Link href="https://github.com/lexic-app/sdk" target="_blank">
                    View SDK on GitHub
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-12 pb-10 text-center text-[12px] text-[#444]">
              Lexic HDK v0.1.0 — Built for HackX 2026
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
