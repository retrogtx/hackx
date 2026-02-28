"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { TreeEditorCanvas } from "@/components/tree-editor/TreeEditorCanvas";
import { TreeEditorHeader } from "@/components/tree-editor/TreeEditorHeader";
import { JsonEditor } from "@/components/tree-editor/JsonEditor";
import { useTreeEditorStore } from "@/lib/tree-editor/store";
import { decisionTreeToFlow, flowToDecisionTree } from "@/lib/tree-editor/transform";
import { Loader2 } from "lucide-react";

export default function TreeEditorPage() {
  const params = useParams();
  const pluginId = params.id as string;
  const treeId = params.treeId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTree = useTreeEditorStore((s) => s.loadTree);
  const nodes = useTreeEditorStore((s) => s.nodes);
  const edges = useTreeEditorStore((s) => s.edges);
  const treeName = useTreeEditorStore((s) => s.treeName);
  const treeDescription = useTreeEditorStore((s) => s.treeDescription);
  const markClean = useTreeEditorStore((s) => s.markClean);
  const editorTab = useTreeEditorStore((s) => s.editorTab);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    // Reset store before loading to prevent stale data from a previous tree
    loadTree([], [], "", "");

    async function fetchTree() {
      try {
        const res = await fetch(`/api/plugins/${pluginId}/trees/${treeId}`);
        if (!res.ok) throw new Error("Failed to load tree");
        const tree = await res.json();

        const { nodes: flowNodes, edges: flowEdges } = decisionTreeToFlow(tree.treeData);
        loadTree(flowNodes, flowEdges, tree.name, tree.description || "");
        setLoadFailed(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tree");
        setLoadFailed(true);
        loadTree([], [], "", "");
      } finally {
        setLoading(false);
      }
    }
    fetchTree();
  }, [pluginId, treeId, loadTree]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const treeData = flowToDecisionTree(nodes, edges);
      const res = await fetch(`/api/plugins/${pluginId}/trees/${treeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: treeName,
          description: treeDescription,
          treeData,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      markClean();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, treeName, treeDescription, pluginId, treeId, markClean]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#666]" />
      </div>
    );
  }

  if (error && !nodes.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-[#0a0a0a]">
        <TreeEditorHeader pluginId={pluginId} saving={saving} onSave={handleSave} saveDisabled={loadFailed} />
        {error && (
          <div className="border-b border-red-500/30 bg-red-900/20 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        {editorTab === "visual" ? <TreeEditorCanvas /> : <JsonEditor />}
      </div>
    </ReactFlowProvider>
  );
}
