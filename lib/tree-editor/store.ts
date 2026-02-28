import { create } from "zustand";
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import type { FlowNodeData } from "./transform";
import {
  answerHandleToKey,
  answerKeyToHandle,
  answerToKey,
  normalizeAnswerLabel,
} from "@/lib/decision-tree/answer-utils";

let nodeCounter = 0;

function nextId() {
  return `node_${Date.now()}_${++nodeCounter}`;
}

export type ViewMode = "simple" | "advanced";
export type EditorTab = "visual" | "json";

interface TreeEditorState {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  treeName: string;
  treeDescription: string;
  isDirty: boolean;
  viewMode: ViewMode;
  editorTab: EditorTab;

  // ReactFlow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  // Actions
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (type: "question" | "condition" | "action", position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<FlowNodeData>) => void;
  renameOption: (nodeId: string, oldOption: string, newOption: string) => void;
  removeOptionEdge: (nodeId: string, option: string) => void;
  setRootNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  setTreeMeta: (name: string, description: string) => void;
  toggleViewMode: () => void;
  setEditorTab: (tab: EditorTab) => void;
  markClean: () => void;
  loadTree: (nodes: Node<FlowNodeData>[], edges: Edge[], name: string, description: string) => void;
}

export const useTreeEditorStore = create<TreeEditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  treeName: "",
  treeDescription: "",
  isDirty: false,
  viewMode: "simple" as ViewMode,
  editorTab: "visual" as EditorTab,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<FlowNodeData>[],
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection) => {
    const { nodes, edges } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);
    if (!sourceNode) return;

    // Action nodes cannot have outgoing connections
    if (sourceNode.data.nodeType === "action") return;

    // No self-connections
    if (connection.source === connection.target) return;

    // No duplicate connections
    const exists = edges.some(
      (e) =>
        e.source === connection.source &&
        e.target === connection.target &&
        e.sourceHandle === connection.sourceHandle,
    );
    if (exists) return;

    // Condition nodes: max 2 outgoing (True + False)
    if (sourceNode.data.nodeType === "condition") {
      const outgoing = edges.filter((e) => e.source === connection.source);
      if (outgoing.length >= 2) return;

      const hasTrue = outgoing.some((e) => e.sourceHandle === "true");
      const hasFalse = outgoing.some((e) => e.sourceHandle === "false");

      let label = "";
      let handle = connection.sourceHandle;
      if (handle === "true" && !hasTrue) label = "True";
      else if (handle === "false" && !hasFalse) label = "False";
      else if (!hasTrue) { label = "True"; handle = "true"; }
      else if (!hasFalse) { label = "False"; handle = "false"; }
      else return;

      const newEdge: Edge = {
        id: `${connection.source}-${handle}-${connection.target}`,
        source: connection.source!,
        sourceHandle: handle,
        target: connection.target!,
        type: "labeled",
        data: { label },
      };
      set({ edges: [...edges, newEdge], isDirty: true });
      return;
    }

    // Question nodes: label by answer, one target per sourceHandle
    if (sourceNode.data.nodeType === "question") {
      const answerKey = answerHandleToKey(connection.sourceHandle);
      if (!answerKey) return;

      const options = sourceNode.data.options || [];
      const matchingOption = options.find((option) => answerToKey(option) === answerKey);
      if (!matchingOption) return;

      const answerLabel = normalizeAnswerLabel(matchingOption);
      const normalizedHandle = answerKeyToHandle(answerKey);

      // Block if this sourceHandle already has a connection
      const handleTaken = edges.some(
        (e) => e.source === connection.source && e.sourceHandle === normalizedHandle,
      );
      if (handleTaken) return;

      const edgeKey = answerToKey(answerLabel) || answerKey;
      const newEdge: Edge = {
        id: `${connection.source}-${edgeKey}-${connection.target}`,
        source: connection.source!,
        sourceHandle: normalizedHandle,
        target: connection.target!,
        type: "labeled",
        data: { label: answerLabel },
      };
      set({ edges: [...edges, newEdge], isDirty: true });
      return;
    }
  },

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  addNode: (type, position) => {
    const id = nextId();
    const defaults: Record<string, FlowNodeData> = {
      question: {
        label: "New Question",
        nodeType: "question",
        isRoot: false,
        questionText: "",
        extractFrom: "",
        options: [],
      },
      condition: {
        label: "New Condition",
        nodeType: "condition",
        isRoot: false,
        conditionField: "",
        conditionOperator: "eq",
        conditionValue: "",
      },
      action: {
        label: "New Action",
        nodeType: "action",
        isRoot: false,
        recommendation: "",
        sourceHint: "",
        severity: "info",
      },
    };

    const newNode: Node<FlowNodeData> = {
      id,
      type,
      position,
      data: defaults[type],
    };

    const { nodes } = get();
    // If this is the first node, make it root
    if (nodes.length === 0) {
      newNode.data = { ...newNode.data, isRoot: true };
    }

    set({ nodes: [...nodes, newNode], isDirty: true });
  },

  deleteNode: (id) => {
    const { nodes, edges, selectedNodeId } = get();
    set({
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: selectedNodeId === id ? null : selectedNodeId,
      isDirty: true,
    });
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
      isDirty: true,
    });
  },

  renameOption: (nodeId, oldOption, newOption) => {
    const { edges } = get();
    const oldKey = answerToKey(oldOption);
    if (!oldKey) return;

    const trimmed = normalizeAnswerLabel(newOption);
    // If renamed to blank, remove the edge entirely
    if (!trimmed) {
      set({
        edges: edges.filter(
          (e) => !(e.source === nodeId && answerHandleToKey(e.sourceHandle) === oldKey),
        ),
        isDirty: true,
      });
      return;
    }
    const newKey = answerToKey(trimmed);

    // Re-key edges that reference the old option handle.
    const updatedEdges = edges.map((e) => {
      if (e.source === nodeId && answerHandleToKey(e.sourceHandle) === oldKey) {
        return {
          ...e,
          id: `${nodeId}-${newKey}-${e.target}`,
          sourceHandle: answerKeyToHandle(newKey),
          data: { ...(e.data as Record<string, unknown>), label: trimmed },
        };
      }
      return e;
    });

    // Keep only one outgoing edge per answer handle.
    const dedupedEdges = updatedEdges.filter(
      (edge, idx, arr) =>
        arr.findIndex(
          (candidate) =>
            candidate.source === edge.source && candidate.sourceHandle === edge.sourceHandle,
        ) === idx,
    );

    set({ edges: dedupedEdges, isDirty: true });
  },

  removeOptionEdge: (nodeId, option) => {
    const { edges } = get();
    const optionKey = answerToKey(option);
    if (!optionKey) return;
    set({
      edges: edges.filter(
        (e) => !(e.source === nodeId && answerHandleToKey(e.sourceHandle) === optionKey),
      ),
      isDirty: true,
    });
  },

  setRootNode: (id) => {
    set({
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, isRoot: n.id === id },
      })),
      isDirty: true,
    });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  setTreeMeta: (name, description) => set({ treeName: name, treeDescription: description, isDirty: true }),

  toggleViewMode: () => set({ viewMode: get().viewMode === "simple" ? "advanced" : "simple" }),

  setEditorTab: (tab) => set({ editorTab: tab }),

  markClean: () => set({ isDirty: false }),

  loadTree: (nodes, edges, name, description) =>
    set({ nodes, edges, treeName: name, treeDescription: description, isDirty: false, selectedNodeId: null }),
}));
