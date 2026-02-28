"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTreeEditorStore } from "@/lib/tree-editor/store";

interface TreeEditorHeaderProps {
  pluginId: string;
  saving: boolean;
  onSave: () => void;
  saveDisabled?: boolean;
}

export function TreeEditorHeader({ pluginId, saving, onSave, saveDisabled }: TreeEditorHeaderProps) {
  const treeName = useTreeEditorStore((s) => s.treeName);
  const treeDescription = useTreeEditorStore((s) => s.treeDescription);
  const isDirty = useTreeEditorStore((s) => s.isDirty);
  const setTreeMeta = useTreeEditorStore((s) => s.setTreeMeta);
  const viewMode = useTreeEditorStore((s) => s.viewMode);
  const toggleViewMode = useTreeEditorStore((s) => s.toggleViewMode);
  const editorTab = useTreeEditorStore((s) => s.editorTab);
  const setEditorTab = useTreeEditorStore((s) => s.setEditorTab);

  return (
    <div className="flex h-14 items-center gap-4 border-b border-[#262626] bg-[#0a0a0a] px-4">
      <Link
        href={`/plugins/${pluginId}/trees`}
        className="flex items-center text-sm text-[#666] transition-colors hover:text-white"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Trees
      </Link>

      <div className="h-6 w-px bg-[#262626]" />

      {/* Visual / JSON tabs */}
      <div className="flex rounded-md border border-[#333] bg-[#111] p-0.5">
        <button
          onClick={() => setEditorTab("visual")}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            editorTab === "visual"
              ? "bg-[#262626] text-white"
              : "text-[#666] hover:text-[#a1a1a1]"
          }`}
        >
          Visual
        </button>
        <button
          onClick={() => setEditorTab("json")}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            editorTab === "json"
              ? "bg-[#262626] text-white"
              : "text-[#666] hover:text-[#a1a1a1]"
          }`}
        >
          JSON
        </button>
      </div>

      <div className="h-6 w-px bg-[#262626]" />

      <Input
        value={treeName}
        onChange={(e) => setTreeMeta(e.target.value, treeDescription)}
        placeholder="Tree name"
        className="h-8 w-48 border-transparent bg-transparent text-white text-sm font-semibold placeholder:text-[#555] hover:border-[#333] focus:border-[#444] focus:ring-0"
      />

      <Input
        value={treeDescription}
        onChange={(e) => setTreeMeta(treeName, e.target.value)}
        placeholder="Description (optional)"
        className="h-8 w-64 border-transparent bg-transparent text-[#a1a1a1] text-sm placeholder:text-[#555] hover:border-[#333] focus:border-[#444] focus:ring-0"
      />

      <div className="ml-auto flex items-center gap-3">
        {/* Simple/Advanced toggle only visible in visual mode */}
        {editorTab === "visual" && (
          <button
            onClick={toggleViewMode}
            className="rounded-md border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-[#a1a1a1] transition-colors hover:border-[#444] hover:text-white"
          >
            {viewMode === "simple" ? "Simple" : "Advanced"}
          </button>
        )}
        {isDirty && <span className="text-xs text-[#666]">Unsaved changes</span>}
        <Button
          size="sm"
          onClick={onSave}
          disabled={!isDirty || saving || saveDisabled}
          className="bg-white text-black hover:bg-[#ccc] font-semibold disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-2 h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}
