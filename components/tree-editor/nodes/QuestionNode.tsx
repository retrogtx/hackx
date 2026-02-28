"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { HelpCircle, Crown } from "lucide-react";
import { answerKeyToHandle, normalizeQuestionOptions } from "@/lib/decision-tree/answer-utils";
import type { FlowNodeData } from "@/lib/tree-editor/transform";
import { useTreeEditorStore } from "@/lib/tree-editor/store";

type QuestionNodeType = Node<FlowNodeData, "question">;

export function QuestionNode({ data, selected }: NodeProps<QuestionNodeType>) {
  const nodeData = data;
  const viewMode = useTreeEditorStore((s) => s.viewMode);
  const simple = viewMode === "simple";
  const options = normalizeQuestionOptions(nodeData.options || []);

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-lg border-2 bg-[#0d2926] text-white shadow-lg ${
        selected ? "border-[#00d4aa] ring-2 ring-[#00d4aa]/30" : "border-[#00d4aa]/50"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-[#00d4aa] !border-[#0a0a0a] !border-2" />

      <div className="flex items-center gap-2 border-b border-[#00d4aa]/20 px-3 py-2">
        <HelpCircle className="h-4 w-4 text-[#00d4aa] shrink-0" />
        <span className="text-xs font-semibold text-[#00d4aa] uppercase tracking-wider">
          {simple ? "Ask" : "Question"}
        </span>
        {nodeData.isRoot && <Crown className="h-3.5 w-3.5 text-amber-400 ml-auto" />}
      </div>

      <div className="px-3 py-2">
        {simple ? (
          <>
            <p className="text-sm font-medium">{nodeData.questionText || nodeData.label}</p>
            {options.length > 0 && (
              <p className="text-xs text-[#a1a1a1] mt-1">
                Answers: {options.join(", ")}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-medium truncate">{nodeData.label}</p>
            {nodeData.questionText && (
              <p className="text-xs text-[#a1a1a1] mt-1 truncate">{nodeData.questionText}</p>
            )}
            {nodeData.extractFrom && (
              <p className="text-[10px] text-[#666] mt-0.5 font-mono">extractFrom: {nodeData.extractFrom}</p>
            )}
          </>
        )}
      </div>

      <div className="flex justify-around px-2 pb-2">
        {options.length > 0 ? (
          options.map((opt, idx) => (
            <div key={`${opt}-${idx}`} className="flex flex-col items-center">
              <span className="text-[10px] text-[#a1a1a1] mb-1">{opt}</span>
              <Handle
                type="source"
                position={Position.Bottom}
                id={answerKeyToHandle(opt)}
                className="!relative !transform-none !w-2.5 !h-2.5 !bg-[#00d4aa] !border-[#0a0a0a] !border-2"
              />
            </div>
          ))
        ) : (
          <span className="text-[10px] text-[#666]">Add options to create branches</span>
        )}
      </div>
    </div>
  );
}
