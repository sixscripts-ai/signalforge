import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// --- SignalForge Tables ---

export const importJob = pgTable(
  "import_job",
  {
    id: text("id").primaryKey(),
    filename: text("filename").notNull(),
    sourceType: text("source_type").notNull(),
    status: text("status").notNull(),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    duplicateRows: integer("duplicate_rows").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_import_job_created_at").on(table.createdAt),
    index("idx_import_job_status").on(table.status),
  ]
);

export const rawRow = pgTable(
  "raw_row",
  {
    id: text("id").primaryKey(),
    importJobId: text("import_job_id")
      .notNull()
      .references(() => importJob.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    rawData: text("raw_data").notNull(),
    status: text("status").notNull(),
    errorSummary: text("error_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_raw_row_import_job_id").on(table.importJobId),
    index("idx_raw_row_status").on(table.status),
  ]
);

export const validationError = pgTable(
  "validation_error",
  {
    id: text("id").primaryKey(),
    importJobId: text("import_job_id")
      .notNull()
      .references(() => importJob.id, { onDelete: "cascade" }),
    rawRowId: text("raw_row_id").references(() => rawRow.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    field: text("field").notNull(),
    message: text("message").notNull(),
    severity: text("severity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_validation_error_import_job_id").on(table.importJobId),
    index("idx_validation_error_severity").on(table.severity),
  ]
);

export const normalizedRecord = pgTable(
  "normalized_record",
  {
    id: text("id").primaryKey(),
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
    index("idx_normalized_record_dedupe_key").on(table.dedupeKey),
    index("idx_normalized_record_import_job_id").on(table.importJobId),
    index("idx_normalized_record_email").on(table.email),
    index("idx_normalized_record_created_at").on(table.createdAt),
  ]
);

export const schemaProfile = pgTable("schema_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  requiredFields: text("required_fields").notNull(),
  fieldMappings: text("field_mappings").notNull(),
  validationRules: text("validation_rules").notNull(),
  dedupeStrategy: text("dedupe_strategy").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Type exports for convenience
export type ImportJob = typeof importJob.$inferSelect;
export type NewImportJob = typeof importJob.$inferInsert;

export type RawRow = typeof rawRow.$inferSelect;
export type NewRawRow = typeof rawRow.$inferInsert;

export type ValidationError = typeof validationError.$inferSelect;
export type NewValidationError = typeof validationError.$inferInsert;

export type NormalizedRecord = typeof normalizedRecord.$inferSelect;
export type NewNormalizedRecord = typeof normalizedRecord.$inferInsert;

export type SchemaProfile = typeof schemaProfile.$inferSelect;
export type NewSchemaProfile = typeof schemaProfile.$inferInsert;
