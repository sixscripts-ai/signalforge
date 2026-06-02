import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// --- Workspace Tables ---

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workspace_member_user_id").on(table.userId),
    index("idx_workspace_member_workspace_id").on(table.workspaceId),
  ]
);

export const workspaceInvitation = pgTable(
  "workspace_invitation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"), // pending, accepted, revoked, expired
    invitedByUserId: text("invited_by_user_id").notNull(),
    acceptedByUserId: text("accepted_by_user_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workspace_invitation_workspace_id").on(table.workspaceId),
    index("idx_workspace_invitation_email").on(table.email),
    index("idx_workspace_invitation_token").on(table.token),
  ]
);

// --- SignalForge Tables ---

export const importJob = pgTable(
  "import_job",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    sourceType: text("source_type").notNull(),
    status: text("status").notNull(),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    autoFixedRows: integer("auto_fixed_rows").notNull().default(0),
    needsReviewRows: integer("needs_review_rows").notNull().default(0),
    duplicateRows: integer("duplicate_rows").notNull().default(0),
    rejectedRows: integer("rejected_rows").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    schemaProfileSnapshot: jsonb("schema_profile_snapshot"),
    importTemplateId: text("import_template_id")
      .references(() => importTemplate.id, { onDelete: "set null" }),
    importTemplateSnapshot: jsonb("import_template_snapshot"),
  },
  (table) => [
    index("idx_import_job_workspace_id").on(table.workspaceId),
    index("idx_import_job_created_at").on(table.createdAt),
    index("idx_import_job_status").on(table.status),
  ]
);

export const importRow = pgTable(
  "import_row",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    importJobId: text("import_job_id")
      .notNull()
      .references(() => importJob.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    status: text("status").notNull(),
    originalData: text("original_data").notNull(),
    cleanedData: text("cleaned_data"),
    issues: text("issues"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_import_row_workspace_id").on(table.workspaceId),
    index("idx_import_row_import_job_id").on(table.importJobId),
    index("idx_import_row_status").on(table.status),
  ]
);

export const normalizedRecord = pgTable(
  "normalized_record",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    importJobId: text("import_job_id")
      .notNull()
      .references(() => importJob.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    name: text("name"),
    email: text("email"),
    company: text("company"),
    category: text("category"),
    amount: doublePrecision("amount"),
    status: text("status"),
    dedupeKey: text("dedupe_key").notNull(),
    sourceRowIndex: integer("source_row_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_normalized_record_workspace_id").on(table.workspaceId),
    index("idx_normalized_record_dedupe_key").on(table.dedupeKey),
    index("idx_normalized_record_import_job_id").on(table.importJobId),
    index("idx_normalized_record_email").on(table.email),
    index("idx_normalized_record_created_at").on(table.createdAt),
  ]
);

export const schemaProfile = pgTable("schema_profile", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  requiredFields: jsonb("required_fields").notNull(),
  fieldMappings: jsonb("field_mappings").notNull(),
  cleanupRules: jsonb("cleanup_rules").notNull(),
  validationRules: jsonb("validation_rules").notNull(),
  dedupeStrategy: jsonb("dedupe_strategy").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Webhook Tables ---

export const webhook = pgTable(
  "webhook",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    signingSecret: text("signing_secret").notNull(),
    events: jsonb("events").notNull().$type<string[]>(),
    active: text("active").notNull().default("true"),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_webhook_workspace_id").on(table.workspaceId),
  ]
);

export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_api_key_workspace_id").on(table.workspaceId),
  ]
);

// --- Import Template Table ---

export const importTemplate = pgTable(
  "import_template",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    schemaProfileId: text("schema_profile_id")
      .references(() => schemaProfile.id, { onDelete: "set null" }),
    config: jsonb("config").notNull(),
    sampleHeaders: jsonb("sample_headers"),
    isDefault: text("is_default").notNull().default("false"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_import_template_workspace_id").on(table.workspaceId),
    index("idx_import_template_is_default").on(table.workspaceId, table.isDefault),
  ]
);

// --- Audit Log Table ---

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_log_workspace_id").on(table.workspaceId),
    index("idx_audit_log_created_at").on(table.createdAt),
    index("idx_audit_log_action").on(table.action),
    index("idx_audit_log_entity_type_id").on(table.entityType, table.entityId),
  ]
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;

export type ImportJob = typeof importJob.$inferSelect;
export type NewImportJob = typeof importJob.$inferInsert;

export type ImportRow = typeof importRow.$inferSelect;
export type NewImportRow = typeof importRow.$inferInsert;

export type NormalizedRecord = typeof normalizedRecord.$inferSelect;
export type NewNormalizedRecord = typeof normalizedRecord.$inferInsert;

export type SchemaProfileRecord = typeof schemaProfile.$inferSelect;
export type NewSchemaProfileRecord = typeof schemaProfile.$inferInsert;

export type WorkspaceInvitation = typeof workspaceInvitation.$inferSelect;
export type NewWorkspaceInvitation = typeof workspaceInvitation.$inferInsert;

export type Webhook = typeof webhook.$inferSelect;
export type NewWebhook = typeof webhook.$inferInsert;

export type ApiKey = typeof apiKey.$inferSelect;
export type NewApiKey = typeof apiKey.$inferInsert;

export type ImportTemplateRecord = typeof importTemplate.$inferSelect;
export type NewImportTemplateRecord = typeof importTemplate.$inferInsert;
