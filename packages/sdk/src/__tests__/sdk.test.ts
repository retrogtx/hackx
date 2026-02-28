/**
 * SDK unit tests — validates type normalization, response formatting,
 * and adapter output for all three entry points (core, langchain, autogpt).
 *
 * Run: npx tsx packages/sdk/src/__tests__/sdk.test.ts
 */

import { Lexic, LexicAPIError } from "../index";
import type { QueryResult, StreamEvent } from "../types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

// ── Helpers to test internal normalization via the public API ─────────

function makeMockServer(response: unknown, status = 200) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      body: null,
    } as Response;
  };
  return () => { globalThis.fetch = originalFetch; };
}

// ── Test: Constructor validation ─────────────────────────────────────

console.log("\n--- Constructor ---");

try {
  new Lexic({ apiKey: "" });
  assert(false, "should throw on empty apiKey");
} catch (e) {
  assert((e as Error).message.includes("apiKey is required"), "throws on empty apiKey");
}

{
  const client = new Lexic({ apiKey: "lx_test", defaultPlugin: "my-plugin" });
  assert(client.getActivePlugin() === "my-plugin", "defaultPlugin sets activePlugin");
}

{
  const client = new Lexic({ apiKey: "lx_test" });
  assert(client.getActivePlugin() === null, "activePlugin starts null when no default");
  client.setActivePlugin("new-plugin");
  assert(client.getActivePlugin() === "new-plugin", "setActivePlugin updates plugin");
}

// ── Test: query() — no plugin specified ──────────────────────────────

console.log("\n--- query() validation ---");

{
  const client = new Lexic({ apiKey: "lx_test" });
  try {
    await client.query({ query: "test" });
    assert(false, "should throw when no plugin set");
  } catch (e) {
    assert((e as Error).message.includes("no plugin specified"), "throws when no plugin");
  }
}

// ── Test: query() — normalizes a well-formed response ────────────────

console.log("\n--- query() response normalization ---");

{
  const fullResponse = {
    answer: "The answer is 42 [Source 1].",
    citations: [
      { id: "src_1", document: "Guide.pdf", page: 10, section: "Ch. 1", excerpt: "The answer..." },
    ],
    decisionPath: [
      { step: 1, node: "q1", label: "Check type", value: "beam" },
    ],
    confidence: "high",
    pluginVersion: "1.0.0",
  };

  const restore = makeMockServer(fullResponse);
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.query({ plugin: "test-plugin", query: "test" });

  assert(result.answer === "The answer is 42 [Source 1].", "answer preserved");
  assert(result.citations.length === 1, "one citation");
  assert(result.citations[0].id === "src_1", "citation id");
  assert(result.citations[0].document === "Guide.pdf", "citation document");
  assert(result.citations[0].page === 10, "citation page");
  assert(result.citations[0].section === "Ch. 1", "citation section");
  assert(result.citations[0].excerpt === "The answer...", "citation excerpt");
  assert(result.decisionPath.length === 1, "one decision step");
  assert(result.decisionPath[0].step === 1, "step number");
  assert(result.decisionPath[0].node === "q1", "step node");
  assert(result.decisionPath[0].label === "Check type", "step label");
  assert(result.decisionPath[0].value === "beam", "step value");
  assert(result.confidence === "high", "confidence high");
  assert(result.pluginVersion === "1.0.0", "pluginVersion");
  restore();
}

// ── Test: query() — normalizes a malformed / partial response ────────

console.log("\n--- query() handles malformed responses ---");

{
  const restore = makeMockServer({ answer: "Partial answer" });
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.query({ plugin: "test-plugin", query: "test" });

  assert(result.answer === "Partial answer", "answer from partial response");
  assert(Array.isArray(result.citations) && result.citations.length === 0, "citations default to []");
  assert(Array.isArray(result.decisionPath) && result.decisionPath.length === 0, "decisionPath default to []");
  assert(result.confidence === "low", "confidence defaults to low");
  assert(result.pluginVersion === "unknown", "pluginVersion defaults to unknown");
  restore();
}

{
  const restore = makeMockServer({});
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.query({ plugin: "test-plugin", query: "test" });

  assert(result.answer === "", "empty object → answer is empty string");
  assert(result.confidence === "low", "empty object → confidence is low");
  restore();
}

{
  const restore = makeMockServer({
    answer: 12345,
    citations: "not-an-array",
    decisionPath: null,
    confidence: "invalid",
    pluginVersion: 99,
  });
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.query({ plugin: "test-plugin", query: "test" });

  assert(result.answer === "", "non-string answer → empty string");
  assert(result.citations.length === 0, "non-array citations → []");
  assert(result.decisionPath.length === 0, "null decisionPath → []");
  assert(result.confidence === "low", "invalid confidence → low");
  assert(result.pluginVersion === "unknown", "non-string pluginVersion → unknown");
  restore();
}

// ── Test: query() — passes context and options through ───────────────

console.log("\n--- query() passes context and options ---");

{
  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return { ok: true, status: 200, json: async () => ({ answer: "ok" }) } as Response;
  };

  const client = new Lexic({ apiKey: "lx_test" });
  await client.query({
    plugin: "test-plugin",
    query: "test",
    context: [{ role: "user", content: "prior question" }],
    options: { citationMode: "inline", maxSources: 3, includeDecisionPath: true },
  });

  const body = capturedBody!;
  assert(body.plugin === "test-plugin", "body has plugin");
  assert(body.query === "test", "body has query");
  assert(Array.isArray(body.context) && (body.context as unknown[]).length === 1, "body has context");
  assert((body.options as Record<string, unknown>)?.citationMode === "inline", "body has options.citationMode");
  assert((body.options as Record<string, unknown>)?.maxSources === 3, "body has options.maxSources");

  globalThis.fetch = originalFetch;
}

// ── Test: query() — omits context/options when not provided ──────────

{
  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return { ok: true, status: 200, json: async () => ({ answer: "ok" }) } as Response;
  };

  const client = new Lexic({ apiKey: "lx_test" });
  await client.query({ plugin: "test-plugin", query: "test" });

  assert(!("context" in (capturedBody || {})), "body omits context when not provided");
  assert(!("options" in (capturedBody || {})), "body omits options when not provided");

  globalThis.fetch = originalFetch;
}

// ── Test: query() — error handling ───────────────────────────────────

console.log("\n--- query() error handling ---");

{
  const restore = makeMockServer({ error: "Invalid API key" }, 401);
  const client = new Lexic({ apiKey: "lx_bad" });
  try {
    await client.query({ plugin: "test-plugin", query: "test" });
    assert(false, "should throw on 401");
  } catch (e) {
    assert(e instanceof LexicAPIError, "throws LexicAPIError");
    assert((e as LexicAPIError).status === 401, "status is 401");
    assert((e as LexicAPIError).message === "Invalid API key", "error message from body");
  }
  restore();
}

// ── Test: LangChain adapter formatting ───────────────────────────────

console.log("\n--- LangChain adapter ---");

{
  const { LexicTool } = await import("../langchain");

  const fullResponse = {
    answer: "Use M25 grade concrete [Source 1].",
    citations: [
      { id: "src_1", document: "IS 456.pdf", page: 47, section: "Table 16", excerpt: "Nominal cover..." },
    ],
    decisionPath: [
      { step: 1, node: "grade", label: "Concrete grade?", value: "M25" },
    ],
    confidence: "high",
    pluginVersion: "1.0.0",
  };

  const restore = makeMockServer(fullResponse);
  const tool = new LexicTool({ apiKey: "lx_test", plugin: "test-plugin" });
  const output = await tool.call("What grade concrete?");
  const parsed = JSON.parse(output);

  assert(parsed.answer === "Use M25 grade concrete [Source 1].", "langchain: answer preserved");
  assert(parsed.confidence === "high", "langchain: confidence included");
  assert(parsed.citations.length === 1, "langchain: one citation");
  assert(parsed.citations[0].id === "src_1", "langchain: citation id included");
  assert(parsed.citations[0].document === "IS 456.pdf", "langchain: document included");
  assert(parsed.citations[0].page === 47, "langchain: page included");
  assert(parsed.citations[0].section === "Table 16", "langchain: section included");
  assert(parsed.citations[0].excerpt === "Nominal cover...", "langchain: excerpt included");
  assert(parsed.decisionPath.length === 1, "langchain: decisionPath included");
  restore();
}

{
  const { LexicTool } = await import("../langchain");

  const minResponse = { answer: "Minimal answer" };
  const restore = makeMockServer(minResponse);
  const tool = new LexicTool({ apiKey: "lx_test", plugin: "test-plugin" });
  const output = await tool.call("test");
  const parsed = JSON.parse(output);

  assert(parsed.answer === "Minimal answer", "langchain: handles minimal response");
  assert(Array.isArray(parsed.citations) && parsed.citations.length === 0, "langchain: empty citations");
  assert(!parsed.decisionPath, "langchain: omits empty decisionPath");
  restore();
}

// ── Test: AutoGPT adapter formatting ─────────────────────────────────

console.log("\n--- AutoGPT adapter ---");

{
  const { LexicAutoGPT } = await import("../autogpt");

  const fullResponse = {
    answer: "Use 45mm cover [Source 1].",
    citations: [
      { id: "src_1", document: "IS 456.pdf", page: 47, section: "Table 16", excerpt: "Cover..." },
    ],
    decisionPath: [
      { step: 1, node: "exp", label: "Exposure?", value: "severe" },
      { step: 2, node: "act", label: "Cover lookup", result: "45mm" },
    ],
    confidence: "high",
    pluginVersion: "1.0.0",
  };

  const restore = makeMockServer(fullResponse);
  const adapter = new LexicAutoGPT({ apiKey: "lx_test", plugin: "test-plugin" });
  const output = await adapter.execute("What cover?");

  assert(output.includes("Expert Answer (confidence: high):"), "autogpt: header line");
  assert(output.includes("Use 45mm cover [Source 1]."), "autogpt: answer body");
  assert(output.includes("[1] IS 456.pdf, p.47 — Table 16"), "autogpt: citation with page + section");
  assert(output.includes("Step 1: Exposure? → severe"), "autogpt: decision step with value");
  assert(output.includes("Step 2: Cover lookup (45mm)"), "autogpt: decision step with result");
  restore();
}

{
  const { LexicAutoGPT } = await import("../autogpt");

  const minResponse = { answer: "No citations here" };
  const restore = makeMockServer(minResponse);
  const adapter = new LexicAutoGPT({ apiKey: "lx_test", plugin: "test-plugin" });
  const output = await adapter.execute("test");

  assert(output.includes("No citations here"), "autogpt: handles no citations");
  assert(!output.includes("Citations:"), "autogpt: omits Citations header when empty");
  assert(!output.includes("Decision Path:"), "autogpt: omits Decision Path when empty");
  restore();
}

// ── Test: AutoGPT asCommand() ────────────────────────────────────────

{
  const { LexicAutoGPT } = await import("../autogpt");

  const adapter = new LexicAutoGPT({ apiKey: "lx_test", plugin: "my-plugin-v1" });
  const cmd = adapter.asCommand();

  assert(cmd.name === "consult_my_plugin_v1", "asCommand: default name from slug");
  assert(cmd.description.includes("my-plugin-v1"), "asCommand: description includes plugin");
  assert(cmd.parameters.query?.required === true, "asCommand: query param required");
}

// ── Test: LexicAPIError ──────────────────────────────────────────────

console.log("\n--- LexicAPIError ---");

{
  const err = new LexicAPIError("test error", 500);
  assert(err instanceof Error, "LexicAPIError extends Error");
  assert(err.name === "LexicAPIError", "name is LexicAPIError");
  assert(err.message === "test error", "message preserved");
  assert(err.status === 500, "status preserved");
}

// ── Test: Type shapes compile correctly ──────────────────────────────

console.log("\n--- Type shape checks ---");

{
  void ({
    apiKey: "lx_test",
    baseUrl: "http://localhost:3000",
    defaultPlugin: "my-plugin",
    timeout: 5000,
  } satisfies import("../types").LexicConfig);

  void ({
    plugin: "test",
    query: "test",
    context: [{ role: "user", content: "hello" }, { role: "assistant", content: "hi" }],
    options: { citationMode: "inline", maxSources: 5, includeDecisionPath: true },
  } satisfies import("../types").QueryOptions);

  void ({
    answer: "test",
    citations: [{ id: "1", document: "doc", excerpt: "text" }],
    decisionPath: [{ step: 1, node: "n", label: "l" }],
    confidence: "high",
    pluginVersion: "1.0.0",
  } satisfies QueryResult);

  void ({ type: "status", status: "searching_kb", message: "msg" } satisfies StreamEvent);
  void ({ type: "delta", text: "token" } satisfies StreamEvent);
  void ({
    type: "done",
    answer: "final answer",
    citations: [],
    decisionPath: [],
    confidence: "high",
    pluginVersion: "1.0.0",
  } satisfies StreamEvent);
  void ({ type: "error", error: "oops" } satisfies StreamEvent);

  assert(true, "all type shapes compile correctly");
}

// ── Test: collaborate() — validation ─────────────────────────────────

console.log("\n--- collaborate() validation ---");

{
  const client = new Lexic({ apiKey: "lx_test" });
  try {
    await client.collaborate({ experts: ["only-one"], query: "test" });
    assert(false, "should throw with <2 experts");
  } catch (e) {
    assert((e as Error).message.includes("at least 2"), "throws when <2 experts");
  }
}

{
  const client = new Lexic({ apiKey: "lx_test" });
  try {
    await client.collaborate({ experts: [], query: "test" });
    assert(false, "should throw with empty experts");
  } catch (e) {
    assert((e as Error).message.includes("at least 2"), "throws on empty experts array");
  }
}

// ── Test: collaborate() — sends correct request body ─────────────────

console.log("\n--- collaborate() request body ---");

{
  let capturedBody: Record<string, unknown> | null = null;
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = typeof url === "string" ? url : url.toString();
    capturedBody = JSON.parse(init?.body as string);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        rounds: [{ roundNumber: 1, responses: [] }],
        consensus: { answer: "ok", confidence: "high", agreementLevel: 1, citations: [], conflicts: [], expertContributions: [] },
        latencyMs: 100,
      }),
    } as Response;
  };

  const client = new Lexic({ apiKey: "lx_test" });
  await client.collaborate({
    experts: ["eng", "safety"],
    query: "Is it safe?",
    mode: "debate",
    maxRounds: 2,
  });

  assert(capturedUrl.includes("/api/v1/collaborate"), "calls collaborate endpoint");
  const body = capturedBody!;
  assert(JSON.stringify(body.experts) === '["eng","safety"]', "body has experts");
  assert(body.query === "Is it safe?", "body has query");
  assert(body.mode === "debate", "body has mode");
  assert(body.maxRounds === 2, "body has maxRounds");

  globalThis.fetch = originalFetch;
}

// ── Test: collaborate() — defaults mode and maxRounds ────────────────

{
  let capturedBody: Record<string, unknown> | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        rounds: [],
        consensus: { answer: "ok", confidence: "low", agreementLevel: 0.5, citations: [], conflicts: [], expertContributions: [] },
        latencyMs: 50,
      }),
    } as Response;
  };

  const client = new Lexic({ apiKey: "lx_test" });
  await client.collaborate({ experts: ["a", "b"], query: "test" });

  const body = capturedBody!;
  assert(body.mode === "debate", "defaults to debate mode");
  assert(body.maxRounds === 3, "defaults to 3 maxRounds");

  globalThis.fetch = originalFetch;
}

// ── Test: collaborate() — normalizes response ────────────────────────

console.log("\n--- collaborate() response handling ---");

{
  const collabResponse = {
    rounds: [
      {
        roundNumber: 1,
        responses: [
          { pluginSlug: "eng", pluginName: "Engineer", domain: "structural", answer: "The beam is fine.", citations: [{ id: "s1", document: "IS456.pdf", excerpt: "clause..." }], confidence: "high", revised: false },
          { pluginSlug: "safety", pluginName: "Safety Expert", domain: "fire-safety", answer: "Check fire rating.", citations: [], confidence: "medium", revised: false },
        ],
      },
    ],
    consensus: {
      answer: "Beam is fine but needs fire rating check.",
      confidence: "high",
      agreementLevel: 0.85,
      citations: [{ id: "s1", document: "IS456.pdf", excerpt: "clause..." }],
      conflicts: [{ topic: "Fire rating", positions: [{ expert: "Engineer", stance: "Not relevant" }, { expert: "Safety Expert", stance: "Critical" }], resolved: true, resolution: "Added fire check" }],
      expertContributions: [{ expert: "Engineer", domain: "structural", keyPoints: ["Beam structurally sound"] }, { expert: "Safety Expert", domain: "fire-safety", keyPoints: ["Fire rating needed"] }],
    },
    latencyMs: 5000,
  };

  const restore = makeMockServer(collabResponse);
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.collaborate({ experts: ["eng", "safety"], query: "test" });

  assert(result.rounds.length === 1, "one round");
  assert(result.rounds[0].responses.length === 2, "two expert responses");
  assert(result.rounds[0].responses[0].pluginSlug === "eng", "first expert slug");
  assert(result.rounds[0].responses[1].answer === "Check fire rating.", "second expert answer");
  assert(result.consensus.answer.includes("fire rating"), "consensus answer");
  assert(result.consensus.confidence === "high", "consensus confidence");
  assert(result.consensus.agreementLevel === 0.85, "agreement level");
  assert(result.consensus.conflicts.length === 1, "one conflict");
  assert(result.consensus.conflicts[0].resolved === true, "conflict resolved");
  assert(result.consensus.expertContributions.length === 2, "two contributions");
  assert(result.latencyMs === 5000, "latency preserved");
  restore();
}

// ── Test: collaborate() — error handling ──────────────────────────────

{
  const restore = makeMockServer({ error: "Plugin not found" }, 404);
  const client = new Lexic({ apiKey: "lx_test" });
  try {
    await client.collaborate({ experts: ["bad", "plugin"], query: "test" });
    assert(false, "should throw on 404");
  } catch (e) {
    assert(e instanceof LexicAPIError, "collaborate: throws LexicAPIError");
    assert((e as LexicAPIError).status === 404, "collaborate: status 404");
    assert((e as LexicAPIError).message === "Plugin not found", "collaborate: error message");
  }
  restore();
}

// ── Test: LangChain collaboration adapter ────────────────────────────

console.log("\n--- LangChain collaboration adapter ---");

{
  const { LexicCollaborationTool } = await import("../langchain");

  const collabResponse = {
    rounds: [{ roundNumber: 1, responses: [] }],
    consensus: {
      answer: "Panel says: safe with caveats.",
      confidence: "high",
      agreementLevel: 0.9,
      citations: [{ id: "s1", document: "Code.pdf", excerpt: "section 4..." }],
      conflicts: [{ topic: "Load type", positions: [{ expert: "Eng", stance: "Live" }], resolved: false }],
      expertContributions: [{ expert: "Eng", domain: "structural", keyPoints: ["Checked loads"] }],
    },
    latencyMs: 3000,
  };

  function makeMockSSEStream(result: Record<string, unknown>) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.stream) {
        const sseData = `data: ${JSON.stringify({ type: "done", ...result })}\n\n`;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sseData));
            controller.close();
          },
        });
        return { ok: true, status: 200, body: stream } as Response;
      }
      return { ok: true, status: 200, json: async () => result } as Response;
    };
    return () => { globalThis.fetch = originalFetch; };
  }

  const restore = makeMockSSEStream(collabResponse);
  const events: string[] = [];
  const tool = new LexicCollaborationTool({
    apiKey: "lx_test",
    experts: ["eng", "safety"],
    mode: "debate",
    onEvent: (e) => events.push(e.type),
  });

  assert(tool.name === "lexic_collaboration", "collab tool: default name");
  assert(tool.description.includes("2 domain experts"), "collab tool: description mentions expert count");

  const output = await tool.call("Is it safe?");
  const parsed = JSON.parse(output);

  assert(parsed.consensus === "Panel says: safe with caveats.", "collab langchain: consensus answer");
  assert(parsed.confidence === "high", "collab langchain: confidence");
  assert(parsed.agreementLevel === 0.9, "collab langchain: agreement level");
  assert(parsed.citations.length === 1, "collab langchain: one citation");
  assert(parsed.conflicts.length === 1, "collab langchain: one conflict");
  assert(parsed.expertContributions.length === 1, "collab langchain: one contribution");
  assert(parsed.roundCount === 1, "collab langchain: round count");
  assert(events.includes("done"), "collab langchain: onEvent received done");
  restore();
}

{
  const { LexicCollaborationTool } = await import("../langchain");
  const tool = new LexicCollaborationTool({ apiKey: "lx_test", experts: ["a", "b"] });
  tool.setExperts(["x", "y", "z"]);
  tool.setMode("review");
  assert(true, "collab langchain: setExperts and setMode work without error");
}

// ── Test: AutoGPT collaboration adapter ──────────────────────────────

console.log("\n--- AutoGPT collaboration adapter ---");

{
  const { LexicCollaborationAutoGPT } = await import("../autogpt");

  const collabResponse = {
    rounds: [{ roundNumber: 1, responses: [] }, { roundNumber: 2, responses: [] }],
    consensus: {
      answer: "Not safe without prestressing.",
      confidence: "high",
      agreementLevel: 0.95,
      citations: [{ id: "s1", document: "IS456.pdf", excerpt: "clause 23..." }],
      conflicts: [{ topic: "Span limit", positions: [{ expert: "Eng", stance: "6m ok" }, { expert: "Code", stance: "4.5m max" }], resolved: true, resolution: "Code limit applies" }],
      expertContributions: [{ expert: "Eng", domain: "structural", keyPoints: ["Checked deflection"] }, { expert: "Code", domain: "building-code", keyPoints: ["Applied IS 875"] }],
    },
    latencyMs: 8000,
  };

  function makeMockSSEStream2(result: Record<string, unknown>) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.stream) {
        const sseData = `data: ${JSON.stringify({ type: "done", ...result })}\n\n`;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sseData));
            controller.close();
          },
        });
        return { ok: true, status: 200, body: stream } as Response;
      }
      return { ok: true, status: 200, json: async () => result } as Response;
    };
    return () => { globalThis.fetch = originalFetch; };
  }

  const restore = makeMockSSEStream2(collabResponse);
  const adapter = new LexicCollaborationAutoGPT({
    apiKey: "lx_test",
    experts: ["eng", "code"],
    mode: "debate",
  });

  const cmd = adapter.asCommand();
  assert(cmd.name === "consult_expert_panel", "collab autogpt: default command name");
  assert(cmd.parameters.query.required === true, "collab autogpt: query param required");

  const output = await adapter.execute("Is a 6m cantilever safe?");
  assert(output.includes("Expert Panel Consensus"), "collab autogpt: header line");
  assert(output.includes("confidence: high"), "collab autogpt: confidence in output");
  assert(output.includes("agreement: 95%"), "collab autogpt: agreement percentage");
  assert(output.includes("Not safe without prestressing."), "collab autogpt: consensus answer");
  assert(output.includes("Expert Contributions:"), "collab autogpt: contributions section");
  assert(output.includes("Checked deflection"), "collab autogpt: key point");
  assert(output.includes("Conflicts:"), "collab autogpt: conflicts section");
  assert(output.includes("RESOLVED: Span limit"), "collab autogpt: conflict status");
  assert(output.includes("Code limit applies"), "collab autogpt: conflict resolution");
  assert(output.includes("Combined Citations:"), "collab autogpt: citations section");
  assert(output.includes("IS456.pdf"), "collab autogpt: citation document");
  assert(output.includes("2 round(s)"), "collab autogpt: round count");
  assert(output.includes("8000ms"), "collab autogpt: latency");
  restore();
}

{
  const { LexicCollaborationAutoGPT } = await import("../autogpt");
  const adapter = new LexicCollaborationAutoGPT({ apiKey: "lx_test", experts: ["a", "b"] });
  adapter.setExperts(["x", "y"]);
  adapter.setMode("consensus");
  assert(true, "collab autogpt: setExperts and setMode work without error");
}

// ── Test: collaborateStreamToResult — error in stream ────────────────

console.log("\n--- collaborateStreamToResult error handling ---");

{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const sseData = `data: ${JSON.stringify({ type: "error", error: "Expert resolution failed" })}\n\n`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });
    return { ok: true, status: 200, body: stream } as Response;
  };

  const client = new Lexic({ apiKey: "lx_test" });
  try {
    await client.collaborateStreamToResult({ experts: ["a", "b"], query: "test" });
    assert(false, "should throw on stream error");
  } catch (e) {
    assert(e instanceof LexicAPIError, "streamToResult: throws LexicAPIError on stream error");
    assert((e as LexicAPIError).message === "Expert resolution failed", "streamToResult: error message");
  }

  globalThis.fetch = originalFetch;
}

// ── Test: Collaboration type shapes ──────────────────────────────────

console.log("\n--- Collaboration type shape checks ---");

{
  void ({
    experts: ["eng", "safety"],
    query: "test",
    mode: "debate",
    maxRounds: 3,
  } satisfies import("../types").CollaborateOptions);

  const expertResp = {
    pluginSlug: "eng",
    pluginName: "Engineer",
    domain: "structural",
    answer: "test",
    citations: [],
    confidence: "high" as const,
    revised: false,
  } satisfies import("../types").ExpertResponse;

  void ({
    roundNumber: 1,
    responses: [expertResp],
  } satisfies import("../types").CollaborationRound);

  const conflict = {
    topic: "Load",
    positions: [{ expert: "Eng", stance: "ok" }],
    resolved: true,
    resolution: "ok",
  } satisfies import("../types").ConflictEntry;

  const consensus = {
    answer: "ok",
    confidence: "high" as const,
    agreementLevel: 0.9,
    citations: [],
    conflicts: [conflict],
    expertContributions: [{ expert: "Eng", domain: "structural", keyPoints: ["ok"] }],
  } satisfies import("../types").ConsensusResult;

  void ({
    rounds: [{ roundNumber: 1, responses: [expertResp] }],
    consensus,
    latencyMs: 1000,
  } satisfies import("../types").CollaborationResult);

  void ({ type: "round_start", round: 1, totalRounds: 3 } satisfies import("../types").CollaborationStreamEvent);
  void ({ type: "expert_response", round: 1, expert: "eng", expertName: "Eng", domain: "structural", answer: "ok", citations: [], confidence: "high", revised: false } satisfies import("../types").CollaborationStreamEvent);
  void ({ type: "done", rounds: [], consensus, latencyMs: 100 } satisfies import("../types").CollaborationStreamEvent);

  assert(true, "all collaboration type shapes compile correctly");
}

// ── Test: review() — validation ───────────────────────────────────────

console.log("\n--- review() validation ---");

{
  const client = new Lexic({ apiKey: "lx_test" });
  try {
    await client.review({ document: "test doc" });
    assert(false, "should throw when no plugin set");
  } catch (e) {
    assert((e as Error).message.includes("no plugin specified"), "review: throws when no plugin");
  }
}

// ── Test: review() — normalizes well-formed response ─────────────────

console.log("\n--- review() response normalization ---");

{
  const fullReviewResponse = {
    documentTitle: "spec.md",
    totalSegments: 3,
    annotations: [
      {
        id: "ann_0",
        segmentIndex: 0,
        startLine: 1,
        endLine: 5,
        originalText: "The API uses HTTP/1.0",
        severity: "error",
        category: "non-compliance",
        issue: "Should use HTTP/2 per guidelines",
        suggestedFix: "Upgrade to HTTP/2",
        citations: [{ id: "src_1", document: "Guidelines.pdf", page: 12, section: "Transport", excerpt: "All APIs must use HTTP/2..." }],
        confidence: "high",
      },
      {
        id: "ann_1",
        segmentIndex: 1,
        startLine: 6,
        endLine: 10,
        originalText: "Auth uses basic auth",
        severity: "warning",
        category: "best-practice",
        issue: "Consider OAuth2",
        suggestedFix: null,
        citations: [],
        confidence: "medium",
      },
    ],
    summary: {
      errorCount: 1,
      warningCount: 1,
      infoCount: 0,
      passCount: 1,
      overallCompliance: "non-compliant",
      topIssues: ["Should use HTTP/2 per guidelines"],
    },
    confidence: "high",
    pluginVersion: "1.0.0",
    latencyMs: 3200,
  };

  const restore = makeMockServer(fullReviewResponse);
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.review({ plugin: "test-plugin", document: "some doc text" });

  assert(result.documentTitle === "spec.md", "review: documentTitle preserved");
  assert(result.totalSegments === 3, "review: totalSegments preserved");
  assert(result.annotations.length === 2, "review: two annotations");
  assert(result.annotations[0].severity === "error", "review: first annotation severity");
  assert(result.annotations[0].issue === "Should use HTTP/2 per guidelines", "review: first annotation issue");
  assert(result.annotations[0].citations.length === 1, "review: first annotation has citation");
  assert(result.annotations[0].citations[0].document === "Guidelines.pdf", "review: citation document");
  assert(result.annotations[1].suggestedFix === null, "review: null suggestedFix preserved");
  assert(result.summary.errorCount === 1, "review: summary errorCount");
  assert(result.summary.overallCompliance === "non-compliant", "review: compliance");
  assert(result.summary.topIssues.length === 1, "review: topIssues");
  assert(result.confidence === "high", "review: overall confidence");
  assert(result.pluginVersion === "1.0.0", "review: pluginVersion");
  assert(result.latencyMs === 3200, "review: latencyMs");
  restore();
}

// ── Test: review() — normalizes malformed response ───────────────────

console.log("\n--- review() handles malformed responses ---");

{
  const restore = makeMockServer({ documentTitle: "test" });
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.review({ plugin: "test-plugin", document: "text" });

  assert(result.documentTitle === "test", "review malformed: documentTitle preserved");
  assert(result.totalSegments === 0, "review malformed: totalSegments defaults to 0");
  assert(Array.isArray(result.annotations) && result.annotations.length === 0, "review malformed: annotations defaults to []");
  assert(result.summary.errorCount === 0, "review malformed: summary defaults errorCount 0");
  assert(result.summary.overallCompliance === "non-compliant", "review malformed: compliance defaults to non-compliant");
  assert(result.confidence === "low", "review malformed: confidence defaults to low");
  assert(result.pluginVersion === "unknown", "review malformed: pluginVersion defaults to unknown");
  restore();
}

{
  const restore = makeMockServer({});
  const client = new Lexic({ apiKey: "lx_test" });
  const result = await client.review({ plugin: "test-plugin", document: "text" });

  assert(result.documentTitle === "", "review empty: documentTitle is empty string");
  assert(result.latencyMs === 0, "review empty: latencyMs defaults to 0");
  restore();
}

// ── Test: review() — error handling ──────────────────────────────────

console.log("\n--- review() error handling ---");

{
  const restore = makeMockServer({ error: "Plugin not found" }, 404);
  const client = new Lexic({ apiKey: "lx_test" });
  try {
    await client.review({ plugin: "bad-plugin", document: "text" });
    assert(false, "should throw on 404");
  } catch (e) {
    assert(e instanceof LexicAPIError, "review error: throws LexicAPIError");
    assert((e as LexicAPIError).status === 404, "review error: status is 404");
    assert((e as LexicAPIError).message === "Plugin not found", "review error: message from body");
  }
  restore();
}

// ── Test: review() — sends correct request body ──────────────────────

console.log("\n--- review() request body ---");

{
  let capturedBody: Record<string, unknown> | null = null;
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = typeof url === "string" ? url : url.toString();
    capturedBody = JSON.parse(init?.body as string);
    return { ok: true, status: 200, json: async () => ({ documentTitle: "ok", annotations: [], summary: {} }) } as Response;
  };

  const client = new Lexic({ apiKey: "lx_test" });
  await client.review({ plugin: "my-plugin", document: "doc content", title: "My Doc" });

  assert(capturedUrl.includes("/api/v1/review"), "review: calls review endpoint");
  const body = capturedBody!;
  assert(body.plugin === "my-plugin", "review body: has plugin");
  assert(body.document === "doc content", "review body: has document");
  assert(body.title === "My Doc", "review body: has title");

  globalThis.fetch = originalFetch;
}

// ── Test: reviewStream() — SSE parsing ───────────────────────────────

console.log("\n--- reviewStream() SSE parsing ---");

{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const events = [
      `data: ${JSON.stringify({ type: "status", status: "segmenting", message: "Segmenting..." })}\n\n`,
      `data: ${JSON.stringify({ type: "annotation", annotation: { id: "ann_0", segmentIndex: 0, startLine: 1, endLine: 3, originalText: "text", severity: "warning", category: "best-practice", issue: "test issue", suggestedFix: null, citations: [], confidence: "medium" } })}\n\n`,
      `data: ${JSON.stringify({ type: "batch_complete", batchIndex: 0, totalBatches: 1 })}\n\n`,
      `data: ${JSON.stringify({ type: "done", documentTitle: "test", totalSegments: 1, annotations: [], summary: { errorCount: 0, warningCount: 1, infoCount: 0, passCount: 0, overallCompliance: "partially-compliant", topIssues: [] }, confidence: "medium", pluginVersion: "1.0.0", latencyMs: 500 })}\n\n`,
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const ev of events) controller.enqueue(encoder.encode(ev));
        controller.close();
      },
    });
    return { ok: true, status: 200, body: stream } as Response;
  };

  const client = new Lexic({ apiKey: "lx_test" });
  const collectedTypes: string[] = [];

  for await (const event of client.reviewStream({ plugin: "test-plugin", document: "test" })) {
    collectedTypes.push(event.type);
    if (event.type === "annotation") {
      assert(event.annotation.severity === "warning", "reviewStream: annotation severity");
      assert(event.annotation.issue === "test issue", "reviewStream: annotation issue");
    }
    if (event.type === "done") {
      assert(event.confidence === "medium", "reviewStream done: confidence");
      assert(event.pluginVersion === "1.0.0", "reviewStream done: pluginVersion");
    }
  }

  assert(collectedTypes.includes("status"), "reviewStream: received status event");
  assert(collectedTypes.includes("annotation"), "reviewStream: received annotation event");
  assert(collectedTypes.includes("batch_complete"), "reviewStream: received batch_complete event");
  assert(collectedTypes.includes("done"), "reviewStream: received done event");

  globalThis.fetch = originalFetch;
}

// ── Test: LangChain review adapter ───────────────────────────────────

console.log("\n--- LangChain review adapter ---");

{
  const { LexicReviewTool } = await import("../langchain");

  const reviewResponse = {
    documentTitle: "api-spec.md",
    totalSegments: 2,
    annotations: [
      { id: "ann_0", segmentIndex: 0, startLine: 1, endLine: 5, originalText: "text", severity: "error", category: "non-compliance", issue: "Missing auth", suggestedFix: "Add OAuth2", citations: [{ id: "s1", document: "Standard.pdf", excerpt: "All endpoints..." }], confidence: "high" },
    ],
    summary: { errorCount: 1, warningCount: 0, infoCount: 0, passCount: 1, overallCompliance: "non-compliant", topIssues: ["Missing auth"] },
    confidence: "high",
    pluginVersion: "1.0.0",
    latencyMs: 2000,
  };

  const restore = makeMockServer(reviewResponse);
  const tool = new LexicReviewTool({ apiKey: "lx_test", plugin: "test-plugin" });

  assert(tool.name === "lexic_review_test_plugin", "review langchain: default name");

  const output = await tool.call("document content here");
  const parsed = JSON.parse(output);

  assert(parsed.documentTitle === "api-spec.md", "review langchain: documentTitle");
  assert(parsed.compliance === "non-compliant", "review langchain: compliance");
  assert(parsed.confidence === "high", "review langchain: confidence");
  assert(parsed.summary.errors === 1, "review langchain: error count");
  assert(parsed.issues.length === 1, "review langchain: one issue");
  assert(parsed.issues[0].severity === "error", "review langchain: issue severity");
  assert(parsed.issues[0].suggestedFix === "Add OAuth2", "review langchain: suggestedFix");
  restore();
}

// ── Test: AutoGPT review adapter ─────────────────────────────────────

console.log("\n--- AutoGPT review adapter ---");

{
  const { LexicAutoGPT } = await import("../autogpt");

  const reviewResponse = {
    documentTitle: "contract.md",
    totalSegments: 3,
    annotations: [
      { id: "ann_0", segmentIndex: 0, startLine: 1, endLine: 5, originalText: "text", severity: "error", category: "non-compliance", issue: "Missing clause 4.2", suggestedFix: "Add clause 4.2", citations: [{ id: "s1", document: "Template.pdf", excerpt: "clause..." }], confidence: "high" },
      { id: "ann_1", segmentIndex: 1, startLine: 6, endLine: 10, originalText: "text", severity: "pass", category: "compliance", issue: "No issues", suggestedFix: null, citations: [], confidence: "high" },
    ],
    summary: { errorCount: 1, warningCount: 0, infoCount: 0, passCount: 2, overallCompliance: "non-compliant", topIssues: ["Missing clause 4.2"] },
    confidence: "high",
    pluginVersion: "1.0.0",
    latencyMs: 4000,
  };

  const restore = makeMockServer(reviewResponse);
  const adapter = new LexicAutoGPT({ apiKey: "lx_test", plugin: "test-plugin" });

  const cmd = adapter.asReviewCommand();
  assert(cmd.name === "review_test_plugin", "review autogpt: command name from slug");
  assert(cmd.parameters.document.required === true, "review autogpt: document param required");

  const output = await adapter.executeReview("document text");
  assert(output.includes("Expert Review"), "review autogpt: header line");
  assert(output.includes("compliance: non-compliant"), "review autogpt: compliance");
  assert(output.includes("confidence: high"), "review autogpt: confidence");
  assert(output.includes("1 errors"), "review autogpt: error count");
  assert(output.includes("[ERROR]"), "review autogpt: severity label");
  assert(output.includes("Missing clause 4.2"), "review autogpt: issue text");
  assert(output.includes("Fix: Add clause 4.2"), "review autogpt: suggested fix");
  assert(output.includes("Template.pdf"), "review autogpt: citation source");
  assert(output.includes("4000ms"), "review autogpt: latency");
  restore();
}

// ── Test: Review type shapes compile correctly ───────────────────────

console.log("\n--- Review type shape checks ---");

{
  void ({
    plugin: "test",
    document: "doc text",
    title: "My Doc",
  } satisfies import("../types").ReviewOptions);

  void ({
    id: "ann_0",
    segmentIndex: 0,
    startLine: 1,
    endLine: 5,
    originalText: "text",
    severity: "error",
    category: "non-compliance",
    issue: "test",
    suggestedFix: null,
    citations: [],
    confidence: "high",
  } satisfies import("../types").ReviewAnnotation);

  void ({
    errorCount: 1,
    warningCount: 0,
    infoCount: 0,
    passCount: 0,
    overallCompliance: "non-compliant",
    topIssues: ["test"],
  } satisfies import("../types").ReviewSummary);

  void ({
    documentTitle: "test",
    totalSegments: 1,
    annotations: [],
    summary: { errorCount: 0, warningCount: 0, infoCount: 0, passCount: 1, overallCompliance: "compliant", topIssues: [] },
    confidence: "high",
    pluginVersion: "1.0.0",
    latencyMs: 100,
  } satisfies import("../types").ReviewResult);

  void ({ type: "status", status: "segmenting", message: "Segmenting..." } satisfies import("../types").ReviewStreamEvent);
  void ({ type: "annotation", annotation: { id: "a", segmentIndex: 0, startLine: 1, endLine: 1, originalText: "", severity: "info", category: "", issue: "", suggestedFix: null, citations: [], confidence: "low" } } satisfies import("../types").ReviewStreamEvent);
  void ({ type: "batch_complete", batchIndex: 0, totalBatches: 1 } satisfies import("../types").ReviewStreamEvent);
  void ({ type: "error", error: "oops" } satisfies import("../types").ReviewStreamEvent);

  assert(true, "all review type shapes compile correctly");
}

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) process.exit(1);
