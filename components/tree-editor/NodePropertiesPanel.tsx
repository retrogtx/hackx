"use client";

import { X, Trash2, Crown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { answerToKey } from "@/lib/decision-tree/answer-utils";
import { useTreeEditorStore } from "@/lib/tree-editor/store";

export function NodePropertiesPanel() {
  const selectedNodeId = useTreeEditorStore((s) => s.selectedNodeId);
  const nodes = useTreeEditorStore((s) => s.nodes);
  const selectNode = useTreeEditorStore((s) => s.selectNode);
  const updateNodeData = useTreeEditorStore((s) => s.updateNodeData);
  const deleteNode = useTreeEditorStore((s) => s.deleteNode);
  const setRootNode = useTreeEditorStore((s) => s.setRootNode);
  const renameOption = useTreeEditorStore((s) => s.renameOption);
  const removeOptionEdge = useTreeEditorStore((s) => s.removeOptionEdge);
  const viewMode = useTreeEditorStore((s) => s.viewMode);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const { data } = node;
  const simple = viewMode === "simple";
  const optionKeyCounts = new Map<string, number>();
  if (data.nodeType === "question") {
    for (const option of data.options || []) {
      const key = answerToKey(option);
      if (!key) continue;
      optionKeyCounts.set(key, (optionKeyCounts.get(key) || 0) + 1);
    }
  }

  const inputClass = "border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0";
  const labelClass = "text-xs text-[#a1a1a1] uppercase tracking-wider";

  const typeLabels = simple
    ? { question: "Ask Something", condition: "Check a Rule", action: "Recommendation" }
    : { question: "Question Node", condition: "Condition Node", action: "Action Node" };

  return (
    <div className="w-80 border-l border-[#262626] bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#262626] p-4">
        <h3 className="text-sm font-semibold text-white">
          {typeLabels[data.nodeType]}
        </h3>
        <button onClick={() => selectNode(null)} className="text-[#666] hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Common: Label */}
        <div className="space-y-2">
          <Label className={labelClass}>{simple ? "Name" : "Label"}</Label>
          <Input
            value={data.label}
            onChange={(e) => updateNodeData(selectedNodeId, { label: e.target.value })}
            className={inputClass}
            placeholder={simple ? "Give this step a name" : "Node label"}
          />
        </div>

        {/* Root node toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#a1a1a1]">
            {simple ? "Starting point" : "Root Node"}
          </span>
          <Button
            size="sm"
            variant={data.isRoot ? "default" : "outline"}
            onClick={() => setRootNode(selectedNodeId)}
            disabled={data.isRoot}
            className={
              data.isRoot
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 h-7 text-xs"
                : "border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white h-7 text-xs"
            }
          >
            <Crown className="mr-1 h-3 w-3" />
            {data.isRoot
              ? (simple ? "Start here" : "Root")
              : (simple ? "Make this the start" : "Set as Root")}
          </Button>
        </div>

        <div className="h-px bg-[#262626]" />

        {/* Question fields */}
        {data.nodeType === "question" && (
          <>
            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "What to ask" : "Question Text"}
              </Label>
              <Textarea
                value={data.questionText || ""}
                onChange={(e) => updateNodeData(selectedNodeId, { questionText: e.target.value })}
                rows={3}
                className={inputClass}
                placeholder={simple ? "e.g., What type of structural member?" : "Question text"}
              />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "Look for this in the query" : "Extract From (field name)"}
              </Label>
              <Input
                value={data.extractFrom || ""}
                onChange={(e) => updateNodeData(selectedNodeId, { extractFrom: e.target.value })}
                className={inputClass}
                placeholder={simple ? "e.g., member_type" : "e.g., member_type"}
              />
              {simple && (
                <p className="text-[10px] text-[#555]">
                  The system will look for this keyword in the user&apos;s query to decide the answer
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "Possible answers" : "Options"}
              </Label>
              <div className="space-y-2">
                {(data.options || []).map((opt, idx) => {
                  const optionKey = answerToKey(opt);
                  const isDuplicate = optionKey !== "" && (optionKeyCounts.get(optionKey) || 0) > 1;
                  return (
                    <div key={idx}>
                      <div className="flex gap-2">
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const oldOpt = (data.options || [])[idx] || "";
                            const nextValue = e.target.value;
                            const nextKey = answerToKey(nextValue);
                            const hasDuplicate = nextKey !== "" && (data.options || []).some(
                              (option, optionIdx) =>
                                optionIdx !== idx && answerToKey(option) === nextKey,
                            );
                            if (hasDuplicate) return;

                            const newOptions = [...(data.options || [])];
                            newOptions[idx] = nextValue;
                            updateNodeData(selectedNodeId, { options: newOptions });
                            if (oldOpt !== nextValue) {
                              renameOption(selectedNodeId, oldOpt, nextValue);
                            }
                          }}
                          className={`${inputClass} flex-1 ${isDuplicate ? "!border-red-500/50" : ""}`}
                          placeholder={simple ? `Answer ${idx + 1}` : `Option ${idx + 1}`}
                        />
                        <button
                          onClick={() => {
                            const removedOpt = (data.options || [])[idx];
                            const newOptions = (data.options || []).filter((_, i) => i !== idx);
                            updateNodeData(selectedNodeId, { options: newOptions });
                            if (removedOpt) {
                              removeOptionEdge(selectedNodeId, removedOpt);
                            }
                          }}
                          className="text-[#666] hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {isDuplicate && (
                        <p className="text-[10px] text-red-400 mt-0.5">Duplicate answer</p>
                      )}
                      {opt === "" && (
                        <p className="text-[10px] text-amber-400 mt-0.5">Empty — will be ignored on save</p>
                      )}
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newOptions = [...(data.options || []), ""];
                    updateNodeData(selectedNodeId, { options: newOptions });
                  }}
                  className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white w-full h-7 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {simple ? "Add Answer" : "Add Option"}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Condition fields */}
        {data.nodeType === "condition" && (
          <>
            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "What to check" : "Field Name"}
              </Label>
              <Input
                value={data.conditionField || ""}
                onChange={(e) => updateNodeData(selectedNodeId, { conditionField: e.target.value })}
                className={inputClass}
                placeholder={simple ? "e.g., exposure level" : "e.g., exposure"}
              />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "How to compare" : "Operator"}
              </Label>
              <select
                value={data.conditionOperator || "eq"}
                onChange={(e) =>
                  updateNodeData(selectedNodeId, {
                    conditionOperator: e.target.value as "eq" | "gt" | "lt" | "contains" | "in",
                  })
                }
                className="w-full rounded-md border border-[#262626] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#444] focus:outline-none focus:ring-0"
              >
                {simple ? (
                  <>
                    <option value="eq">is exactly</option>
                    <option value="gt">is greater than</option>
                    <option value="lt">is less than</option>
                    <option value="contains">contains</option>
                    <option value="in">is one of</option>
                  </>
                ) : (
                  <>
                    <option value="eq">Equals (eq)</option>
                    <option value="gt">Greater than (gt)</option>
                    <option value="lt">Less than (lt)</option>
                    <option value="contains">Contains</option>
                    <option value="in">In (list)</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "Compare against" : "Value"}
              </Label>
              <Input
                value={data.conditionValue || ""}
                onChange={(e) => updateNodeData(selectedNodeId, { conditionValue: e.target.value })}
                className={inputClass}
                placeholder={simple ? 'e.g., "severe"' : "e.g., severe"}
              />
            </div>

            {simple && (
              <div className="rounded-md bg-[#111] border border-[#262626] p-3">
                <p className="text-xs text-[#a1a1a1]">
                  This rule reads:{" "}
                  <span className="text-white">
                    {data.conditionField && data.conditionValue
                      ? `If ${data.conditionField} ${
                          { eq: "is", gt: "is greater than", lt: "is less than", contains: "contains", in: "is one of" }[data.conditionOperator || "eq"]
                        } "${data.conditionValue}" → go to Yes, otherwise → go to No`
                      : "Fill in the fields above to see the rule"}
                  </span>
                </p>
              </div>
            )}
          </>
        )}

        {/* Action fields */}
        {data.nodeType === "action" && (
          <>
            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "What to recommend" : "Recommendation"}
              </Label>
              <Textarea
                value={data.recommendation || ""}
                onChange={(e) => updateNodeData(selectedNodeId, { recommendation: e.target.value })}
                rows={4}
                className={inputClass}
                placeholder={simple ? "What should the user be told?" : "45mm nominal cover required..."}
              />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "Where is this from?" : "Source Hint"}
              </Label>
              <Input
                value={data.sourceHint || ""}
                onChange={(e) => updateNodeData(selectedNodeId, { sourceHint: e.target.value })}
                className={inputClass}
                placeholder={simple ? "e.g., IS 456 Table 16" : "IS 456 Table 16"}
              />
              {simple && (
                <p className="text-[10px] text-[#555]">
                  Reference to the source document or guideline
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>
                {simple ? "How urgent is this?" : "Severity"}
              </Label>
              <select
                value={data.severity || "info"}
                onChange={(e) =>
                  updateNodeData(selectedNodeId, {
                    severity: e.target.value as "info" | "warning" | "critical",
                  })
                }
                className="w-full rounded-md border border-[#262626] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#444] focus:outline-none focus:ring-0"
              >
                {simple ? (
                  <>
                    <option value="info">Normal — just information</option>
                    <option value="warning">Important — needs attention</option>
                    <option value="critical">Urgent — immediate action</option>
                  </>
                ) : (
                  <>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </>
                )}
              </select>
            </div>
          </>
        )}

        <div className="h-px bg-[#262626]" />

        {/* Delete */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => deleteNode(selectedNodeId)}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {simple ? "Remove this step" : "Delete Node"}
        </Button>
      </div>
    </div>
  );
}
