import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users (synced from Clerk via webhook) ──────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Plugins ────────────────────────────────────────────────────────

export const plugins = pgTable("plugins", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  domain: text("domain").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  citationMode: text("citation_mode").default("mandatory").notNull(),
  version: text("version").default("1.0.0").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  config: jsonb("config").default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("plugins_slug_idx").on(table.slug),
  index("plugins_creator_idx").on(table.creatorId),
]);

// ─── Knowledge Base Documents ───────────────────────────────────────

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: uuid("plugin_id").references(() => plugins.id, { onDelete: "cascade" }).notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  storagePath: text("storage_path"),
  rawText: text("raw_text"),
  metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("kd_plugin_idx").on(table.pluginId),
]);

// ─── Knowledge Chunks (for pgvector search) ─────────────────────────

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => knowledgeDocuments.id, { onDelete: "cascade" }).notNull(),
  pluginId: uuid("plugin_id").references(() => plugins.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  pageNumber: integer("page_number"),
  sectionTitle: text("section_title"),
  embedding: vector("embedding", { dimensions: 1536 }),
  metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("kc_plugin_idx").on(table.pluginId),
  index("kc_document_idx").on(table.documentId),
]);

// ─── Decision Trees ─────────────────────────────────────────────────

export interface DecisionNode {
  id: string;
  type: "condition" | "action" | "question";
  label: string;
  condition?: {
    field: string;
    operator: "eq" | "gt" | "lt" | "contains" | "in";
    value: string | number | string[];
  };
  trueChildId?: string;
  falseChildId?: string;
  question?: {
    text: string;
    options?: string[];
    extractFrom?: string;
  };
  childrenByAnswer?: Record<string, string>;
  action?: {
    recommendation: string;
    sourceHint: string;
    severity?: "info" | "warning" | "critical";
  };
}

export interface DecisionTreeData {
  rootNodeId: string;
  nodes: Record<string, DecisionNode>;
}

export const decisionTrees = pgTable("decision_trees", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: uuid("plugin_id").references(() => plugins.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  treeData: jsonb("tree_data").notNull().$type<DecisionTreeData>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("dt_plugin_idx").on(table.pluginId),
]);

// ─── API Keys ───────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyEncrypted: text("key_encrypted"),
  name: text("name").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ak_user_idx").on(table.userId),
]);

// ─── Collaboration Rooms ─────────────────────────────────────────────

export const collaborationRooms = pgTable("collaboration_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("debate").$type<"debate" | "consensus" | "review">(),
  expertSlugs: jsonb("expert_slugs").notNull().$type<string[]>(),
  maxRounds: integer("max_rounds").default(3).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("cr_creator_idx").on(table.creatorId),
]);

export interface ExpertResponse {
  pluginSlug: string;
  pluginName: string;
  domain: string;
  answer: string;
  citations: CitationEntry[];
  confidence: "high" | "medium" | "low";
  revised?: boolean;
  revisionNote?: string;
}

export interface CollaborationRoundData {
  roundNumber: number;
  responses: ExpertResponse[];
}

export interface ConflictEntry {
  topic: string;
  positions: Array<{ expert: string; stance: string }>;
  resolved: boolean;
  resolution?: string;
}

export interface ConsensusData {
  answer: string;
  confidence: "high" | "medium" | "low";
  agreementLevel: number;
  citations: CitationEntry[];
  conflicts: ConflictEntry[];
  expertContributions: Array<{ expert: string; domain: string; keyPoints: string[] }>;
}

export const collaborationSessions = pgTable("collaboration_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => collaborationRooms.id, { onDelete: "cascade" }).notNull(),
  queryText: text("query_text").notNull(),
  rounds: jsonb("rounds").default([]).$type<CollaborationRoundData[]>(),
  consensus: jsonb("consensus").$type<ConsensusData>(),
  status: text("status").notNull().default("pending").$type<"pending" | "deliberating" | "complete" | "error">(),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("cs_room_idx").on(table.roomId),
]);

// ─── Review Logs ────────────────────────────────────────────────────

export interface ReviewAnnotationData {
  id: string;
  segmentIndex: number;
  startLine: number;
  endLine: number;
  originalText: string;
  severity: "error" | "warning" | "info" | "pass";
  category: string;
  issue: string;
  suggestedFix: string | null;
  citations: CitationEntry[];
  confidence: "high" | "medium" | "low";
}

export interface ReviewSummaryData {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passCount: number;
  overallCompliance: "compliant" | "partially-compliant" | "non-compliant";
  topIssues: string[];
}

export const reviewLogs = pgTable("review_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: uuid("plugin_id").references(() => plugins.id).notNull(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  documentTitle: text("document_title").notNull(),
  documentText: text("document_text").notNull(),
  totalSegments: integer("total_segments").notNull(),
  annotations: jsonb("annotations").default([]).$type<ReviewAnnotationData[]>(),
  summary: jsonb("summary").$type<ReviewSummaryData>(),
  confidence: text("confidence"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("rl_plugin_idx").on(table.pluginId),
]);

// ─── Query Audit Log ────────────────────────────────────────────────

export interface CitationEntry {
  id: string;
  document: string;
  page?: number;
  section?: string;
  excerpt: string;
  documentId?: string;
  chunkId?: string;
  chunkIndex?: number;
  sourceRank?: number;
  similarity?: number;
  fileType?: string;
}

export interface DecisionStep {
  step: number;
  node: string;
  label: string;
  value?: string;
  result?: string;
}

export const queryLogs = pgTable("query_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: uuid("plugin_id").references(() => plugins.id).notNull(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  queryText: text("query_text").notNull(),
  responseText: text("response_text").notNull(),
  citations: jsonb("citations").default([]).$type<CitationEntry[]>(),
  decisionPath: jsonb("decision_path").default([]).$type<DecisionStep[]>(),
  confidence: text("confidence"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ql_plugin_idx").on(table.pluginId),
]);

// ─── Relations ──────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  plugins: many(plugins),
  apiKeys: many(apiKeys),
  collaborationRooms: many(collaborationRooms),
}));

export const pluginsRelations = relations(plugins, ({ one, many }) => ({
  creator: one(users, { fields: [plugins.creatorId], references: [users.id] }),
  documents: many(knowledgeDocuments),
  chunks: many(knowledgeChunks),
  decisionTrees: many(decisionTrees),
  queryLogs: many(queryLogs),
  reviewLogs: many(reviewLogs),
}));

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({ one, many }) => ({
  plugin: one(plugins, { fields: [knowledgeDocuments.pluginId], references: [plugins.id] }),
  chunks: many(knowledgeChunks),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  document: one(knowledgeDocuments, { fields: [knowledgeChunks.documentId], references: [knowledgeDocuments.id] }),
  plugin: one(plugins, { fields: [knowledgeChunks.pluginId], references: [plugins.id] }),
}));

export const decisionTreesRelations = relations(decisionTrees, ({ one }) => ({
  plugin: one(plugins, { fields: [decisionTrees.pluginId], references: [plugins.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const queryLogsRelations = relations(queryLogs, ({ one }) => ({
  plugin: one(plugins, { fields: [queryLogs.pluginId], references: [plugins.id] }),
  apiKey: one(apiKeys, { fields: [queryLogs.apiKeyId], references: [apiKeys.id] }),
}));

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
  plugin: one(plugins, { fields: [reviewLogs.pluginId], references: [plugins.id] }),
  apiKey: one(apiKeys, { fields: [reviewLogs.apiKeyId], references: [apiKeys.id] }),
}));

export const collaborationRoomsRelations = relations(collaborationRooms, ({ one, many }) => ({
  creator: one(users, { fields: [collaborationRooms.creatorId], references: [users.id] }),
  sessions: many(collaborationSessions),
}));

export const collaborationSessionsRelations = relations(collaborationSessions, ({ one }) => ({
  room: one(collaborationRooms, { fields: [collaborationSessions.roomId], references: [collaborationRooms.id] }),
}));
