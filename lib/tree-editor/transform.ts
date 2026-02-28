import type { Node, Edge } from "@xyflow/react";
import type { DecisionTreeData, DecisionNode } from "@/lib/db/schema";
import {
  answerHandleToKey,
  answerKeyToHandle,
  answerToKey,
  normalizeAnswerLabel,
  normalizeQuestionOptions,
} from "@/lib/decision-tree/answer-utils";

export interface FlowNodeData {
  [key: string]: unknown;
  label: string;
  nodeType: DecisionNode["type"];
  isRoot: boolean;
  // Question fields
  questionText?: string;
  extractFrom?: string;
  options?: string[];
  // Condition fields
  conditionField?: string;
  conditionOperator?: "eq" | "gt" | "lt" | "contains" | "in";
  conditionValue?: string;
  // Action fields
  recommendation?: string;
  sourceHint?: string;
  severity?: "info" | "warning" | "critical";
}

const NODE_SPACING_X = 250;
const NODE_SPACING_Y = 150;

function parseInConditionValue(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

/**
 * Convert a DecisionTreeData JSON structure into ReactFlow nodes and edges.
 * Uses BFS from root to auto-layout nodes in a top-down tree.
 */
export function decisionTreeToFlow(tree: DecisionTreeData): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];

  if (!tree || !tree.rootNodeId || !tree.nodes) {
    return { nodes, edges };
  }

  // First pass: count nodes at each depth for centering
  const depthNodes: Map<number, string[]> = new Map();
  const bfsQueue: { id: string; depth: number }[] = [{ id: tree.rootNodeId, depth: 0 }];
  const bfsVisited = new Set<string>();

  while (bfsQueue.length > 0) {
    const { id, depth } = bfsQueue.shift()!;
    if (bfsVisited.has(id) || !tree.nodes[id]) continue;
    bfsVisited.add(id);

    if (!depthNodes.has(depth)) depthNodes.set(depth, []);
    depthNodes.get(depth)!.push(id);

    const node = tree.nodes[id];
    const children = getChildren(node);
    for (const childId of children) {
      if (!bfsVisited.has(childId)) {
        bfsQueue.push({ id: childId, depth: depth + 1 });
      }
    }
  }

  // Second pass: create reachable nodes with centered positions
  for (const [depth, nodeIds] of depthNodes) {
    const count = nodeIds.length;
    nodeIds.forEach((nodeId, idx) => {
      const dn = tree.nodes[nodeId];
      if (!dn) return;

      const x = (idx - (count - 1) / 2) * NODE_SPACING_X;
      const y = depth * NODE_SPACING_Y;

      nodes.push({
        id: nodeId,
        type: dn.type,
        position: { x, y },
        data: decisionNodeToFlowData(dn, nodeId === tree.rootNodeId),
      });
    });
  }

  // Third pass: include disconnected (unreachable) nodes.
  const maxDepth = Math.max(...Array.from(depthNodes.keys()), 0);
  let orphanIndex = 0;
  for (const [nodeId, dn] of Object.entries(tree.nodes)) {
    if (bfsVisited.has(nodeId)) continue;
    nodes.push({
      id: nodeId,
      type: dn.type,
      position: {
        x: (orphanIndex - 1) * NODE_SPACING_X,
        y: (maxDepth + 2) * NODE_SPACING_Y,
      },
      data: decisionNodeToFlowData(dn, false),
    });
    orphanIndex++;
  }

  // Build edges from every node, including disconnected subgraphs.
  for (const [nodeId, dn] of Object.entries(tree.nodes)) {
    buildEdgesForNode(nodeId, dn, edges);
  }

  return { nodes, edges };
}

function buildEdgesForNode(nodeId: string, dn: DecisionNode, edges: Edge[]) {
  if (dn.type === "condition") {
    if (dn.trueChildId) {
      edges.push({
        id: `${nodeId}-true-${dn.trueChildId}`,
        source: nodeId,
        sourceHandle: "true",
        target: dn.trueChildId,
        type: "labeled",
        data: { label: "True" },
      });
    }
    if (dn.falseChildId) {
      edges.push({
        id: `${nodeId}-false-${dn.falseChildId}`,
        source: nodeId,
        sourceHandle: "false",
        target: dn.falseChildId,
        type: "labeled",
        data: { label: "False" },
      });
    }
  } else if (dn.type === "question" && dn.childrenByAnswer) {
    const optionLabels = normalizeQuestionOptions(dn.question?.options || []);
    if (optionLabels.length === 0) return;

    const optionLabelByKey = new Map<string, string>();
    for (const optionLabel of optionLabels) {
      optionLabelByKey.set(answerToKey(optionLabel), optionLabel);
    }

    const usedAnswerKeys = new Set<string>();
    for (const [answer, childId] of Object.entries(dn.childrenByAnswer)) {
      const answerKey = answerToKey(answer);
      if (!answerKey || usedAnswerKeys.has(answerKey)) continue;
      const optionLabel = optionLabelByKey.get(answerKey);
      if (!optionLabel) continue;

      edges.push({
        id: `${nodeId}-${answerKey}-${childId}`,
        source: nodeId,
        sourceHandle: answerKeyToHandle(answerKey),
        target: childId,
        type: "labeled",
        data: { label: optionLabel },
      });
      usedAnswerKeys.add(answerKey);
    }
  }
}

function decisionNodeToFlowData(node: DecisionNode, isRoot: boolean): FlowNodeData {
  const data: FlowNodeData = {
    label: node.label,
    nodeType: node.type,
    isRoot,
  };

  if (node.type === "question" && node.question) {
    data.questionText = node.question.text;
    data.extractFrom = node.question.extractFrom;
    data.options = normalizeQuestionOptions(node.question.options || []);
  } else if (node.type === "condition" && node.condition) {
    data.conditionField = node.condition.field;
    data.conditionOperator = node.condition.operator;
    data.conditionValue = Array.isArray(node.condition.value)
      ? node.condition.value.join(", ")
      : String(node.condition.value);
  } else if (node.type === "action" && node.action) {
    data.recommendation = node.action.recommendation;
    data.sourceHint = node.action.sourceHint;
    data.severity = node.action.severity;
  }

  return data;
}

function getChildren(node: DecisionNode): string[] {
  const children: string[] = [];
  if (node.trueChildId) children.push(node.trueChildId);
  if (node.falseChildId) children.push(node.falseChildId);
  if (node.type === "question" && node.childrenByAnswer) {
    const optionKeys = new Set(
      normalizeQuestionOptions(node.question?.options || []).map((option) => answerToKey(option)),
    );
    for (const [answer, childId] of Object.entries(node.childrenByAnswer)) {
      if (optionKeys.has(answerToKey(answer))) {
        children.push(childId);
      }
    }
  } else if (node.childrenByAnswer) {
    children.push(...Object.values(node.childrenByAnswer));
  }
  return children;
}

/**
 * Convert ReactFlow nodes and edges back into DecisionTreeData JSON format.
 */
export function flowToDecisionTree(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): DecisionTreeData {
  const rootNode = nodes.find((n) => n.data.isRoot);
  if (!rootNode) {
    throw new Error("No root node found. Please mark one node as root.");
  }

  const decisionNodes: Record<string, DecisionNode> = {};

  for (const node of nodes) {
    const dn: DecisionNode = {
      id: node.id,
      type: node.data.nodeType,
      label: node.data.label,
    };

    if (node.data.nodeType === "question") {
      const cleanOptions = normalizeQuestionOptions(node.data.options || []);
      const optionKeys = new Set(cleanOptions.map((option) => answerToKey(option)));

      dn.question = {
        text: node.data.questionText || "",
        options: cleanOptions,
        extractFrom: node.data.extractFrom || "",
      };

      // Build childrenByAnswer from edges, normalized by answer key and limited to live options.
      const outEdges = edges.filter((e) => e.source === node.id);
      if (outEdges.length > 0) {
        const childrenByAnswer: Record<string, string> = {};
        for (const edge of outEdges) {
          const label = normalizeAnswerLabel((edge.data as { label?: string })?.label || "");
          const keyFromHandle = answerHandleToKey(edge.sourceHandle);
          const answerKey = keyFromHandle ?? (label ? answerToKey(label) : "");

          if (!answerKey) continue;
          if (!optionKeys.has(answerKey)) continue;
          if (answerKey in childrenByAnswer) continue;

          childrenByAnswer[answerKey] = edge.target;
        }

        if (Object.keys(childrenByAnswer).length > 0) {
          dn.childrenByAnswer = childrenByAnswer;
        }
      }
    } else if (node.data.nodeType === "condition") {
      const operator = node.data.conditionOperator || "eq";
      dn.condition = {
        field: node.data.conditionField || "",
        operator,
        value:
          operator === "in"
            ? parseInConditionValue(node.data.conditionValue || "")
            : node.data.conditionValue || "",
      };

      // Build trueChildId/falseChildId from edges
      const outEdges = edges.filter((e) => e.source === node.id);
      for (const edge of outEdges) {
        const label = (edge.data as { label?: string })?.label || "";
        if (edge.sourceHandle === "true" || label === "True") {
          dn.trueChildId = edge.target;
        } else if (edge.sourceHandle === "false" || label === "False") {
          dn.falseChildId = edge.target;
        }
      }
    } else if (node.data.nodeType === "action") {
      dn.action = {
        recommendation: node.data.recommendation || "",
        sourceHint: node.data.sourceHint || "",
        severity: node.data.severity || "info",
      };
    }

    decisionNodes[node.id] = dn;
  }

  return {
    rootNodeId: rootNode.id,
    nodes: decisionNodes,
  };
}
