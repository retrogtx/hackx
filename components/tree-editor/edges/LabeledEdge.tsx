"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useTreeEditorStore } from "@/lib/tree-editor/store";

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const viewMode = useTreeEditorStore((s) => s.viewMode);
  const simple = viewMode === "simple";

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const rawLabel = (data as { label?: string })?.label || "";

  let displayLabel = rawLabel;
  if (simple) {
    if (rawLabel === "True") displayLabel = "Yes";
    else if (rawLabel === "False") displayLabel = "No";
  }

  let pillColor = "bg-[#333] text-[#a1a1a1]";
  if (rawLabel === "True") pillColor = "bg-green-900/60 text-green-400 border border-green-700/40";
  else if (rawLabel === "False") pillColor = "bg-red-900/60 text-red-400 border border-red-700/40";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#00d4aa" : "#404040",
          strokeWidth: selected ? 2 : 1.5,
        }}
      />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillColor} nodrag nopan`}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
