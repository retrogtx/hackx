"use client";

import { useReactFlow } from "@xyflow/react";
import { HelpCircle, GitBranch, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTreeEditorStore } from "@/lib/tree-editor/store";

export function NodeToolbar() {
  const addNode = useTreeEditorStore((s) => s.addNode);
  const viewMode = useTreeEditorStore((s) => s.viewMode);
  const { screenToFlowPosition } = useReactFlow();

  function handleAdd(type: "question" | "condition" | "action") {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addNode(type, position);
  }

  const simple = viewMode === "simple";

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <Button
        size="sm"
        onClick={() => handleAdd("question")}
        className="bg-[#0d2926] border border-[#00d4aa]/30 text-[#00d4aa] hover:bg-[#0d2926]/80 hover:border-[#00d4aa]/60 gap-2 justify-start"
      >
        <HelpCircle className="h-4 w-4" />
        {simple ? "Ask Something" : "Question"}
      </Button>
      <Button
        size="sm"
        onClick={() => handleAdd("condition")}
        className="bg-[#0d1b2a] border border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#0d1b2a]/80 hover:border-[#3b82f6]/60 gap-2 justify-start"
      >
        <GitBranch className="h-4 w-4" />
        {simple ? "Check a Rule" : "Condition"}
      </Button>
      <Button
        size="sm"
        onClick={() => handleAdd("action")}
        className="bg-[#2a2210] border border-amber-500/30 text-amber-400 hover:bg-[#2a2210]/80 hover:border-amber-500/60 gap-2 justify-start"
      >
        <Zap className="h-4 w-4" />
        {simple ? "Recommend" : "Action"}
      </Button>
    </div>
  );
}
