import type { DecisionTreeData, DecisionNode } from "@/lib/db/schema";
import { answerToKey } from "@/lib/decision-tree/answer-utils";

export interface DecisionStep {
  nodeId: string;
  label: string;
  type: DecisionNode["type"];
  result?: boolean;
  answer?: string;
  action?: DecisionNode["action"];
}

export interface DecisionResult {
  path: DecisionStep[];
  recommendation?: DecisionNode["action"];
}

export function executeDecisionTree(
  tree: DecisionTreeData,
  extractedParams: Record<string, string>,
): DecisionResult {
  const path: DecisionStep[] = [];
  let currentNode = tree.nodes[tree.rootNodeId];

  let maxSteps = 50; // safety limit
  while (currentNode && maxSteps-- > 0) {
    if (currentNode.type === "condition") {
      const value = extractedParams[currentNode.condition!.field];
      const result = evaluateCondition(currentNode.condition!, value);
      path.push({
        nodeId: currentNode.id,
        label: currentNode.label,
        type: "condition",
        result,
      });
      const nextId = result ? currentNode.trueChildId : currentNode.falseChildId;
      currentNode = nextId ? tree.nodes[nextId] : undefined!;
    } else if (currentNode.type === "question") {
      const field = currentNode.question?.extractFrom;
      const answer = field ? extractedParams[field] : undefined;
      const nextId = answer ? resolveQuestionChildId(currentNode, answer) : undefined;

      if (answer && nextId) {
        path.push({
          nodeId: currentNode.id,
          label: currentNode.label,
          type: "question",
          answer,
        });
        currentNode = tree.nodes[nextId];
      } else {
        // Can't resolve — record and stop
        path.push({
          nodeId: currentNode.id,
          label: currentNode.label,
          type: "question",
          answer: answer || "unresolved",
        });
        break;
      }
    } else if (currentNode.type === "action") {
      path.push({
        nodeId: currentNode.id,
        label: currentNode.label,
        type: "action",
        action: currentNode.action,
      });
      break;
    } else {
      break;
    }
  }

  const lastAction = path.find((s) => s.type === "action");
  return {
    path,
    recommendation: lastAction?.action,
  };
}

function resolveQuestionChildId(
  node: DecisionNode,
  answer: string,
): string | undefined {
  const childrenByAnswer = node.childrenByAnswer;
  if (!childrenByAnswer) return undefined;

  // Fast path for trees that store raw answer keys.
  if (childrenByAnswer[answer]) {
    return childrenByAnswer[answer];
  }

  const normalizedAnswer = answerToKey(answer);
  if (!normalizedAnswer) return undefined;

  if (childrenByAnswer[normalizedAnswer]) {
    return childrenByAnswer[normalizedAnswer];
  }

  // Backward compatibility with mixed or legacy key formatting.
  for (const [storedAnswer, childId] of Object.entries(childrenByAnswer)) {
    if (answerToKey(storedAnswer) === normalizedAnswer) {
      return childId;
    }
  }

  // Backward compatibility for legacy trees that stored question branches without options.
  const normalizedOptions = (node.question?.options || [])
    .map((option) => answerToKey(option))
    .filter((option) => option !== "");
  if (normalizedOptions.length === 0) {
    if (childrenByAnswer.default) return childrenByAnswer.default;
    if (childrenByAnswer.__default__) return childrenByAnswer.__default__;

    const entries = Object.entries(childrenByAnswer);
    if (entries.length === 1) {
      return entries[0][1];
    }
  }

  return undefined;
}

function evaluateCondition(
  condition: NonNullable<DecisionNode["condition"]>,
  value: string | undefined,
): boolean {
  if (value === undefined) return false;
  const normalizedValue = value.trim().toLowerCase();

  switch (condition.operator) {
    case "eq":
      return normalizedValue === String(condition.value).trim().toLowerCase();
    case "gt":
      return Number(value) > Number(condition.value);
    case "lt":
      return Number(value) < Number(condition.value);
    case "contains":
      return normalizedValue.includes(String(condition.value).trim().toLowerCase());
    case "in":
      if (Array.isArray(condition.value)) {
        return condition.value.map((v) => v.trim().toLowerCase()).includes(normalizedValue);
      }

      if (typeof condition.value === "string") {
        return condition.value
          .split(",")
          .map((v) => v.trim().toLowerCase())
          .filter((v) => v !== "")
          .includes(normalizedValue);
      }

      return false;
    default:
      return false;
  }
}
