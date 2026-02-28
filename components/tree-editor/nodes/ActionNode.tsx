"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Zap, AlertTriangle, Info, Crown } from "lucide-react";
import type { FlowNodeData } from "@/lib/tree-editor/transform";
import { useTreeEditorStore } from "@/lib/tree-editor/store";

type ActionNodeType = Node<FlowNodeData, "action">;

const severityConfig = {
  info: {
    border: "border-[#00d4aa]/50",
    borderActive: "border-[#00d4aa] ring-2 ring-[#00d4aa]/30",
    bg: "bg-[#0d2926]",
    text: "text-[#00d4aa]",
    handle: "!bg-[#00d4aa]",
    icon: Info,
    headerBorder: "border-[#00d4aa]/20",
    simpleLabel: "Recommendation",
  },
  warning: {
    border: "border-amber-500/50",
    borderActive: "border-amber-500 ring-2 ring-amber-500/30",
    bg: "bg-[#2a2210]",
    text: "text-amber-400",
    handle: "!bg-amber-400",
    icon: AlertTriangle,
    headerBorder: "border-amber-500/20",
    simpleLabel: "Warning",
  },
  critical: {
    border: "border-red-500/50",
    borderActive: "border-red-500 ring-2 ring-red-500/30",
    bg: "bg-[#2a1010]",
    text: "text-red-400",
    handle: "!bg-red-400",
    icon: Zap,
    headerBorder: "border-red-500/20",
    simpleLabel: "Urgent",
  },
};

export function ActionNode({ data, selected }: NodeProps<ActionNodeType>) {
  const nodeData = data;
  const viewMode = useTreeEditorStore((s) => s.viewMode);
  const simple = viewMode === "simple";
  const severity = nodeData.severity || "info";
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-lg border-2 ${config.bg} text-white shadow-lg ${
        selected ? config.borderActive : config.border
      }`}
    >
      <Handle type="target" position={Position.Top} className={`!w-3 !h-3 ${config.handle} !border-[#0a0a0a] !border-2`} />

      <div className={`flex items-center gap-2 border-b ${config.headerBorder} px-3 py-2`}>
        <Icon className={`h-4 w-4 ${config.text} shrink-0`} />
        <span className={`text-xs font-semibold ${config.text} uppercase tracking-wider`}>
          {simple ? config.simpleLabel : "Action"}
        </span>
        {nodeData.isRoot && <Crown className="h-3.5 w-3.5 text-amber-400 ml-auto" />}
      </div>

      <div className="px-3 py-2">
        {simple ? (
          <>
            <p className="text-sm font-medium">{nodeData.label}</p>
            {nodeData.recommendation && (
              <p className="text-xs text-[#a1a1a1] mt-1 line-clamp-3">{nodeData.recommendation}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-medium truncate">{nodeData.label}</p>
            {nodeData.recommendation && (
              <p className="text-xs text-[#a1a1a1] mt-1 line-clamp-2">{nodeData.recommendation}</p>
            )}
            {nodeData.sourceHint && (
              <p className="text-[10px] text-[#666] mt-0.5 font-mono">source: {nodeData.sourceHint}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
