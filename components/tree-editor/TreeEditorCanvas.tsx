"use client";

import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTreeEditorStore } from "@/lib/tree-editor/store";
import { nodeTypes } from "./nodes";
import { LabeledEdge } from "./edges/LabeledEdge";
import { NodeToolbar } from "./NodeToolbar";
import { NodePropertiesPanel } from "./NodePropertiesPanel";

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

export function TreeEditorCanvas() {
  const nodes = useTreeEditorStore((s) => s.nodes);
  const edges = useTreeEditorStore((s) => s.edges);
  const onNodesChange = useTreeEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useTreeEditorStore((s) => s.onEdgesChange);
  const onConnect = useTreeEditorStore((s) => s.onConnect);
  const selectNode = useTreeEditorStore((s) => s.selectNode);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{ type: "labeled" }}
          deleteKeyCode={["Backspace", "Delete"]}
          className="tree-editor-canvas"
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#1a1a1a"
          />
          <Controls
            position="bottom-left"
            className="tree-editor-controls"
          />
          <MiniMap
            position="bottom-right"
            nodeColor={(node) => {
              switch (node.type) {
                case "question": return "#00d4aa";
                case "condition": return "#3b82f6";
                case "action": return "#f59e0b";
                default: return "#666";
              }
            }}
            maskColor="rgba(0, 0, 0, 0.7)"
            className="tree-editor-minimap"
          />
        </ReactFlow>
        <NodeToolbar />
      </div>
      <NodePropertiesPanel />
    </div>
  );
}
