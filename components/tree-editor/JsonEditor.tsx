"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTreeEditorStore } from "@/lib/tree-editor/store";
import { flowToDecisionTree, decisionTreeToFlow } from "@/lib/tree-editor/transform";
import { Check, AlertTriangle, Copy } from "lucide-react";

export function JsonEditor() {
  const nodes = useTreeEditorStore((s) => s.nodes);
  const edges = useTreeEditorStore((s) => s.edges);
  const loadTree = useTreeEditorStore((s) => s.loadTree);
  const treeName = useTreeEditorStore((s) => s.treeName);
  const treeDescription = useTreeEditorStore((s) => s.treeDescription);

  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync visual → JSON whenever we switch to this tab
  useEffect(() => {
    try {
      if (nodes.length === 0) {
        setJsonText(JSON.stringify({ rootNodeId: "", nodes: {} }, null, 2));
      } else {
        const treeData = flowToDecisionTree(nodes, edges);
        setJsonText(JSON.stringify(treeData, null, 2));
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert to JSON");
    }
  }, []);

  function handleApply() {
    setError("");
    try {
      const treeData = JSON.parse(jsonText);

      if (!treeData.nodes || typeof treeData.nodes !== "object") {
        throw new Error("Missing or invalid 'nodes' object");
      }
      const nodeKeys = Object.keys(treeData.nodes);
      if (nodeKeys.length > 0 && !treeData.rootNodeId) {
        throw new Error("Missing rootNodeId — set it to one of: " + nodeKeys.slice(0, 3).join(", "));
      }
      if (treeData.rootNodeId && !treeData.nodes[treeData.rootNodeId]) {
        throw new Error(
          `rootNodeId "${treeData.rootNodeId}" does not exist in nodes. Available: ${nodeKeys.slice(0, 5).join(", ")}`,
        );
      }

      const { nodes: flowNodes, edges: flowEdges } = decisionTreeToFlow(treeData);
      loadTree(flowNodes, flowEdges, treeName, treeDescription);

      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON: " + err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to apply JSON");
      }
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-[#262626] px-4 py-2">
        <span className="text-xs text-[#a1a1a1]">
          Edit the JSON below and click Apply to update the visual editor
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white h-7 text-xs"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-green-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            className="bg-white text-black hover:bg-[#ccc] font-semibold h-7 text-xs"
          >
            {applied ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Applied
              </>
            ) : (
              "Apply to Canvas"
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-900/20 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Editor */}
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none bg-[#0a0a0a] p-4 font-mono text-sm text-[#ededed] outline-none selection:bg-[#264f78] placeholder:text-[#555]"
        placeholder='{"rootNodeId": "", "nodes": {}}'
      />
    </div>
  );
}
