"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, GitBranch, Loader2, Trash2, Pencil } from "lucide-react";

interface Tree {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function DecisionTreesPage() {
  const params = useParams();
  const router = useRouter();
  const pluginId = params.id as string;
  const [trees, setTrees] = useState<Tree[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadTrees = useCallback(async () => {
    const res = await fetch(`/api/plugins/${pluginId}/trees`);
    if (res.ok) setTrees(await res.json());
  }, [pluginId]);

  useEffect(() => {
    loadTrees();
  }, [loadTrees]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      const treeData = {
        rootNodeId: "",
        nodes: {},
      };

      const res = await fetch(`/api/plugins/${pluginId}/trees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, treeData }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const tree = await res.json();
      router.push(`/plugins/${pluginId}/trees/${tree.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tree");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(treeId: string) {
    if (!confirm("Delete this decision tree? This cannot be undone.")) return;

    setDeleting(treeId);
    try {
      const res = await fetch(`/api/plugins/${pluginId}/trees/${treeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      await loadTrees();
    } catch {
      setError("Failed to delete tree");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <Link
        href={`/plugins/${pluginId}`}
        className="mb-4 inline-flex items-center text-sm text-[#666] transition-colors hover:text-white"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to plugin
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Decision Trees</h1>
          <p className="text-[#a1a1a1]">
            Define structured reasoning flows for domain-specific logic
          </p>
        </div>
        <Button onClick={() => setCreating(!creating)} className="bg-white text-black hover:bg-[#ccc] font-semibold">
          <Plus className="mr-2 h-4 w-4" />
          New Tree
        </Button>
      </div>

      {creating && (
        <div className="mb-6 rounded-md border border-[#262626] bg-[#0a0a0a]">
          <div className="border-b border-[#262626] p-6">
            <h2 className="font-bold text-white">Create Decision Tree</h2>
            <p className="mt-1 text-sm text-[#a1a1a1]">
              Give your tree a name and you&apos;ll be taken to the visual editor.
            </p>
          </div>
          <div className="p-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#ededed]">Tree Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Beam Cover Check"
                  required
                  className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-[#ededed]">Description</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Determines required cover based on member type and exposure"
                  className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
                />
              </div>

              {error && <p className="text-sm text-[#ff4444]">{error}</p>}

              <div className="flex gap-3">
                <Button type="submit" disabled={loading} className="bg-white text-black hover:bg-[#ccc] font-semibold">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create & Open Editor"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreating(false)}
                  className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {trees.length === 0 && !creating ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-[#333] py-16">
          <GitBranch className="mb-3 h-10 w-10 text-[#333]" />
          <p className="mb-4 text-sm text-[#a1a1a1]">
            No decision trees yet. Trees add structured reasoning to your
            plugin.
          </p>
          <Button onClick={() => setCreating(true)} className="bg-white text-black hover:bg-[#ccc] font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            Create First Tree
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {trees.map((tree) => (
            <div
              key={tree.id}
              className="group flex items-center justify-between rounded-md border border-[#262626] bg-[#0a0a0a] p-4 transition-colors hover:border-[#333]"
            >
              <Link
                href={`/plugins/${pluginId}/trees/${tree.id}`}
                className="flex flex-1 items-center gap-3"
              >
                <GitBranch className="h-5 w-5 text-[#00d4aa]" />
                <div>
                  <p className="font-semibold text-white">{tree.name}</p>
                  {tree.description && (
                    <p className="text-sm text-[#a1a1a1]">
                      {tree.description}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <Badge
                  className={tree.isActive
                    ? "bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20"
                    : "bg-[#1a1a1a] text-[#666] border-[#262626]"
                  }
                >
                  {tree.isActive ? "Active" : "Inactive"}
                </Badge>
                <Link
                  href={`/plugins/${pluginId}/trees/${tree.id}`}
                  className="text-[#666] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => handleDelete(tree.id)}
                  disabled={deleting === tree.id}
                  className="text-[#666] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  {deleting === tree.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
