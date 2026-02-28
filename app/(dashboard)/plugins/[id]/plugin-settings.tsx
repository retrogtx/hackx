"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Copy, Eye, EyeOff, ChevronDown, Key } from "lucide-react";

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
}

export function PluginSettings({
  pluginId,
  initialName,
  initialDescription,
  initialDomain,
  initialSystemPrompt,
  initialCitationMode,
  slug,
  isPublished,
}: {
  pluginId: string;
  initialName: string;
  initialDescription: string;
  initialDomain: string;
  initialSystemPrompt: string;
  initialCitationMode: string;
  slug: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [domain, setDomain] = useState(initialDomain);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [citationMode, setCitationMode] = useState(initialCitationMode);

  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyDropdownOpen, setKeyDropdownOpen] = useState(false);

  const loadKeys = useCallback(async () => {
    const res = await fetch("/api/api-keys");
    if (res.ok) {
      const keys: ApiKeyInfo[] = await res.json();
      setApiKeys(keys);
      if (keys.length > 0) {
        setSelectedKeyId((prev) => prev || keys[0].id);
      }
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const selectedKey = apiKeys.find((k) => k.id === selectedKeyId);

  const hasChanges =
    name !== initialName ||
    description !== initialDescription ||
    domain !== initialDomain ||
    systemPrompt !== initialSystemPrompt ||
    citationMode !== initialCitationMode;

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`/api/plugins/${pluginId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, domain, systemPrompt, citationMode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const bearerToken = selectedKey
    ? keyRevealed && revealedKey
      ? revealedKey
      : selectedKey.keyPrefix.slice(0, 7) + "••••"
    : "lx_your_key_here";

  async function toggleReveal() {
    if (keyRevealed) {
      setKeyRevealed(false);
      setRevealedKey(null);
      return;
    }
    if (!selectedKeyId) return;
    setKeyLoading(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedKeyId }),
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedKey(data.key);
        setKeyRevealed(true);
      }
    } finally {
      setKeyLoading(false);
    }
  }

  const [snippetMode, setSnippetMode] = useState<"json" | "stream">("stream");
  const [snippetLang, setSnippetLang] = useState<"curl" | "typescript" | "python">("curl");

  function getApiSnippet() {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    if (snippetLang === "typescript") {
      if (snippetMode === "stream") {
        return `import { Lexic } from "lexic-sdk";

const lexic = new Lexic({
  apiKey: "${bearerToken}",
  baseUrl: "${baseUrl}",
});

for await (const event of lexic.queryStream({
  plugin: "${slug}",
  query: "Your question here",
})) {
  switch (event.type) {
    case "status":
      console.log(\`[\${event.status}] \${event.message}\`);
      break;
    case "delta":
      process.stdout.write(event.text);
      break;
    case "done":
      console.log("\\nCitations:", event.citations);
      console.log("Confidence:", event.confidence);
      break;
  }
}`;
      }
      return `import { Lexic } from "lexic-sdk";

const lexic = new Lexic({
  apiKey: "${bearerToken}",
  baseUrl: "${baseUrl}",
});

const result = await lexic.query({
  plugin: "${slug}",
  query: "Your question here",
});

console.log(result.answer);
console.log(result.citations);
console.log(result.confidence);`;
    }

    if (snippetLang === "python") {
      if (snippetMode === "stream") {
        return `import requests

resp = requests.post(
    "${baseUrl}/api/v1/query",
    headers={
        "Authorization": "Bearer ${bearerToken}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    },
    json={
        "plugin": "${slug}",
        "query": "Your question here",
        "stream": True,
    },
    stream=True,
)

for line in resp.iter_lines():
    if line and line.startswith(b"data: "):
        import json
        event = json.loads(line[6:])
        if event["type"] == "status":
            print(f"[{event['status']}] {event['message']}")
        elif event["type"] == "delta":
            print(event["text"], end="", flush=True)
        elif event["type"] == "done":
            print(f"\\nCitations: {event['citations']}")`;
      }
      return `import requests

resp = requests.post(
    "${baseUrl}/api/v1/query",
    headers={
        "Authorization": "Bearer ${bearerToken}",
        "Content-Type": "application/json",
    },
    json={
        "plugin": "${slug}",
        "query": "Your question here",
    },
)

data = resp.json()
print(data["answer"])
print(data["citations"])
print(data["confidence"])`;
    }

    if (snippetMode === "stream") {
      return `curl -N -X POST ${baseUrl}/api/v1/query \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{
    "plugin": "${slug}",
    "query": "Your question here",
    "stream": true
  }'`;
    }
    return `curl -X POST ${baseUrl}/api/v1/query \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plugin": "${slug}",
    "query": "Your question here"
  }'`;
  }

  function copySnippet() {
    navigator.clipboard.writeText(getApiSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Plugin Settings */}
      <div className="rounded-md border border-[#262626] bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-[#262626] px-6 py-4">
          <h2 className="font-bold text-white">Plugin Settings</h2>
          <div className="flex items-center gap-2">
            {error && <p className="text-sm text-[#ff4444]">{error}</p>}
            {saved && <p className="text-sm text-[#00d4aa]">Saved</p>}
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-white text-black hover:bg-[#ccc] font-semibold disabled:opacity-40"
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="mr-2 h-3 w-3" />
                  Saved
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[#a1a1a1]">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-[#262626] bg-[#111111] text-white focus:border-[#444] focus:ring-0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#a1a1a1]">Domain</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="border-[#262626] bg-[#111111] text-white focus:border-[#444] focus:ring-0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#a1a1a1]">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#a1a1a1]">Citation Mode</Label>
            <Select value={citationMode} onValueChange={setCitationMode}>
              <SelectTrigger className="border-[#262626] bg-[#111111] text-white focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#262626] bg-[#111111]">
                <SelectItem value="mandatory">Mandatory — every claim must cite a source</SelectItem>
                <SelectItem value="optional">Optional — citations encouraged but not required</SelectItem>
                <SelectItem value="off">Off — no citations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[#a1a1a1]">System Prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={8}
              className="border-[#262626] bg-[#111111] text-white text-sm placeholder:text-[#555] focus:border-[#444] focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* API Usage */}
      <div className="rounded-md border border-[#262626] bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-[#262626] px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-white">API Usage</h2>
            {isPublished ? (
              <Badge className="bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20">Live</Badge>
            ) : (
              <Badge className="bg-[#1a1a1a] text-[#666] border-[#262626]">Publish to enable</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Key selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setKeyDropdownOpen(!keyDropdownOpen)}
                className="flex items-center gap-2 rounded-md border border-[#262626] bg-[#111111] px-3 py-1.5 text-xs text-[#a1a1a1] transition-colors hover:border-[#444] hover:text-white"
              >
                <Key className="h-3 w-3 text-[#666]" />
                {selectedKey ? selectedKey.name : "Select key"}
                <ChevronDown className={`h-3 w-3 text-[#666] transition-transform ${keyDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {keyDropdownOpen && apiKeys.length > 0 && (
                <div className="absolute right-0 z-10 mt-1 min-w-[200px] rounded-md border border-[#262626] bg-[#111111] py-1 shadow-lg">
                  {apiKeys.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        setSelectedKeyId(k.id);
                        setKeyDropdownOpen(false);
                        setKeyRevealed(false);
                        setRevealedKey(null);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#1a1a1a] ${
                        k.id === selectedKeyId ? "text-white bg-[#1a1a1a]" : "text-[#a1a1a1]"
                      }`}
                    >
                      <Key className="h-3 w-3 shrink-0 text-[#666]" />
                      <span className="truncate">{k.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-[#555]">{k.keyPrefix}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Eye toggle */}
            <button
              type="button"
              onClick={toggleReveal}
              disabled={!selectedKey || keyLoading}
              className="rounded-md border border-[#262626] p-1.5 text-[#a1a1a1] transition-colors hover:bg-[#1a1a1a] hover:text-white disabled:opacity-30"
            >
              {keyLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : keyRevealed ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Copy curl */}
            <Button
              variant="outline"
              size="sm"
              onClick={copySnippet}
              className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3 w-3 text-[#00d4aa]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border border-[#262626] bg-[#111111] p-0.5">
              {(["curl", "typescript", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSnippetLang(lang)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${snippetLang === lang ? "bg-[#262626] text-white" : "text-[#666] hover:text-[#a1a1a1]"}`}
                >
                  {lang === "curl" ? "cURL" : lang === "typescript" ? "TypeScript" : "Python"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-[#262626] bg-[#111111] p-0.5">
              <button
                type="button"
                onClick={() => setSnippetMode("stream")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${snippetMode === "stream" ? "bg-[#00d4aa]/20 text-[#00d4aa]" : "text-[#666] hover:text-[#a1a1a1]"}`}
              >
                Streaming
              </button>
              <button
                type="button"
                onClick={() => setSnippetMode("json")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${snippetMode === "json" ? "bg-[#262626] text-white" : "text-[#666] hover:text-[#a1a1a1]"}`}
              >
                JSON
              </button>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-md border border-[#262626] bg-[#111111] p-4 text-sm text-[#ededed]">
            {getApiSnippet()}
          </pre>
          {snippetMode === "stream" && (
            <p className="text-xs text-[#555]">
              Streaming returns real-time status updates ({'"searching_kb"'}, {'"web_search"'}, {'"generating"'}), text tokens, and final citations.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
