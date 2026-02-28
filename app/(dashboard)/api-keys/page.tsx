"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadKeys = useCallback(async () => {
    const res = await fetch("/api/api-keys");
    if (res.ok) setKeys(await res.json());
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(data.key);
        setCreating(false);
        await loadKeys();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
    await loadKeys();
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage keys for external agents to query your plugins
          </p>
        </div>
        <Button onClick={() => { setCreating(true); setNewKey(null); }}>
          <Plus className="mr-2 h-4 w-4" />
          New Key
        </Button>
      </div>

      {newKey && (
        <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">
              Your new API key (copy it now — it won&apos;t be shown again):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
                {newKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {creating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create API Key</CardTitle>
            <CardDescription>
              Give your key a descriptive name to remember what it&apos;s used for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  name="name"
                  placeholder="e.g., Production Agent, LangChain Demo"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {initialLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
        </div>
      ) : keys.length === 0 && !creating ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <Key className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="mb-4 text-sm text-muted-foreground">
              No API keys yet. Create one to let external agents query your plugins.
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code>{k.keyPrefix}...</code>
                      {k.lastUsedAt && (
                        <span>
                          Last used{" "}
                          {new Date(k.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(k.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Usage Example</CardTitle>
          <CardDescription>
            Use your API key to query any published plugin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1/query \\
  -H "Authorization: Bearer sme_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plugin": "your-plugin-slug",
    "query": "Your question here"
  }'`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
