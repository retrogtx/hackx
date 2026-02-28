"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setError(null);
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
      } else {
        setError(data.error || "Failed to create API key");
      }
    } catch {
      setError("Network error — failed to create API key");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/api-keys?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete API key");
      }
      setDeleteTarget(null);
      await loadKeys();
    } catch (err) {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    } finally {
      setDeleting(false);
    }
  }

  async function copyKey() {
    if (newKey) {
      try {
        await navigator.clipboard.writeText(newKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert("Failed to copy — please select and copy the key manually");
      }
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-[#a1a1a1]">
            Manage keys for external agents to query your plugins
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setNewKey(null);
          }}
          className="bg-white text-black hover:bg-[#ccc] font-semibold"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Key
        </Button>
      </div>

      {newKey && (
        <div className="mb-6 rounded-md border border-[#00d4aa]/30 bg-[#00d4aa]/5 p-4">
          <p className="mb-2 text-sm font-semibold text-[#00d4aa]">
            Your new API key (copy it now — it won&apos;t be shown again):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-[#262626] bg-[#111111] px-3 py-2 text-sm text-white">
              {newKey}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copyKey}
              className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#00d4aa]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md border border-[#ff4444]/30 bg-[#ff4444]/5 p-4">
          <p className="text-sm text-[#ff4444]">{error}</p>
        </div>
      )}

      {creating && (
        <div className="mb-6 rounded-md border border-[#262626] bg-[#0a0a0a]">
          <div className="border-b border-[#262626] p-6">
            <h2 className="font-bold text-white">Create API Key</h2>
            <p className="mt-1 text-sm text-[#a1a1a1]">
              Give your key a descriptive name to remember what it&apos;s used
              for.
            </p>
          </div>
          <div className="p-6">
            <form onSubmit={handleCreate} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="keyName" className="text-[#ededed]">
                  Key Name
                </Label>
                <Input
                  id="keyName"
                  name="name"
                  placeholder="e.g., Production Agent, LangChain Demo"
                  required
                  className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="bg-white text-black hover:bg-[#ccc] font-semibold"
              >
                {loading ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreating(false)}
                className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
              >
                Cancel
              </Button>
            </form>
          </div>
        </div>
      )}

      {initialLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-white" />
        </div>
      ) : keys.length === 0 && !creating ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-[#333] py-16">
          <Key className="mb-3 h-10 w-10 text-[#333]" />
          <p className="mb-4 text-sm text-[#a1a1a1]">
            No API keys yet. Create one to let external agents query your
            plugins.
          </p>
          <Button
            onClick={() => setCreating(true)}
            className="bg-white text-black hover:bg-[#ccc] font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create First Key
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-md border border-[#262626] bg-[#0a0a0a] p-4 transition-colors hover:border-[#333]"
            >
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-[#666]" />
                <div>
                  <p className="font-semibold text-white">{k.name}</p>
                  <div className="flex items-center gap-2 text-sm text-[#666]">
                    <code className="text-[#888]">{k.keyPrefix}...</code>
                    {k.lastUsedAt && (
                      <span>
                        Last used {new Date(k.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(k)}
                className="text-[#666] hover:text-[#ff4444] hover:bg-[#ff4444]/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-md border border-[#262626] bg-[#0a0a0a]">
        <div className="border-b border-[#262626] p-6">
          <h2 className="font-bold text-white">Usage Example</h2>
          <p className="mt-1 text-sm text-[#a1a1a1]">
            Use your API key to query any published plugin
          </p>
        </div>
        <div className="p-6">
          <pre className="overflow-x-auto rounded-lg border border-[#262626] bg-[#111111] p-4 text-sm text-[#ededed]">
          {`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/v1/query \\
  -H "Authorization: Bearer lx_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plugin": "your-plugin-slug",
    "query": "Your question here"
  }'`}
          </pre>
        </div>
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="border-[#262626] bg-[#0a0a0a] sm:max-w-[400px]"
        >
          <DialogHeader>
            <DialogTitle className="text-white">Delete API Key</DialogTitle>
            <DialogDescription className="text-[#a1a1a1]">
              This will permanently delete{" "}
              <span className="font-medium text-white">
                {deleteTarget?.name}
              </span>{" "}
              and revoke all access. Any agents using this key will immediately
              stop working.
            </DialogDescription>
          </DialogHeader>
          <div className="w-fit rounded-md border border-[#ff4444]/20 bg-[#ff4444]/5 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff4444]" />
              <p className="text-sm text-[#ff4444]">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#ff4444] text-white hover:bg-[#e03c3c] font-semibold"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
