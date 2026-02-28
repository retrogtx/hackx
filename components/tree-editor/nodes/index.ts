import { QuestionNode } from "./QuestionNode";
import { ConditionNode } from "./ConditionNode";
import { ActionNode } from "./ActionNode";
import type { NodeTypes } from "@xyflow/react";

export const nodeTypes: NodeTypes = {
  question: QuestionNode,
  condition: ConditionNode,
  action: ActionNode,
};
