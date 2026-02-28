"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { GitBranch, Crown } from "lucide-react";
import type { FlowNodeData } from "@/lib/tree-editor/transform";
import { useTreeEditorStore } from "@/lib/tree-editor/store";

type ConditionNodeType = Node<FlowNodeData, "condition">;

const operatorLabels: Record<string, string> = {
  eq: "is",
  gt: "is greater than",
  lt: "is less than",
  contains: "contains",
  in: "is one of",
};

export function ConditionNode({ data, selected }: NodeProps<ConditionNodeType>) {
  const nodeData = data;
  const viewMode = useTreeEditorStore((s) => s.viewMode);
  const simple = viewMode === "simple";

  const field = nodeData.conditionField;
  const op = nodeData.conditionOperator || "eq";
  const value = nodeData.conditionValue;

  const simpleSummary =
    field && value
      ? `If ${field} ${operatorLabels[op] || op} "${value}"`
      : "";

  const advancedSummary =
    field && op && value
      ? `${field} ${op} ${value}`
      : "";

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-lg border-2 bg-[#0d1b2a] text-white shadow-lg ${
        selected ? "border-[#3b82f6] ring-2 ring-[#3b82f6]/30" : "border-[#3b82f6]/50"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-[#3b82f6] !border-[#0a0a0a] !border-2" />

      <div className="flex items-center gap-2 border-b border-[#3b82f6]/20 px-3 py-2">
        <GitBranch className="h-4 w-4 text-[#3b82f6] shrink-0" />
        <span className="text-xs font-semibold text-[#3b82f6] uppercase tracking-wider">
          {simple ? "Rule" : "Condition"}
        </span>
        {nodeData.isRoot && <Crown className="h-3.5 w-3.5 text-amber-400 ml-auto" />}
      </div>

      <div className="px-3 py-2">
        {simple ? (
          <>
            <p className="text-sm font-medium">{nodeData.label}</p>
            {simpleSummary && (
              <p className="text-xs text-[#a1a1a1] mt-1">{simpleSummary}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-medium truncate">{nodeData.label}</p>
            {advancedSummary && (
              <p className="text-xs text-[#a1a1a1] mt-1 truncate font-mono">{advancedSummary}</p>
            )}
          </>
        )}
      </div>

      <div className="flex justify-around px-2 pb-2">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-green-400 mb-1">{simple ? "Yes" : "True"}</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!relative !transform-none !w-2.5 !h-2.5 !bg-green-400 !border-[#0a0a0a] !border-2"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-red-400 mb-1">{simple ? "No" : "False"}</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!relative !transform-none !w-2.5 !h-2.5 !bg-red-400 !border-[#0a0a0a] !border-2"
          />
        </div>
      </div>
    </div>
  );
}
