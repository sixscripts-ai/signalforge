import { z } from "zod";

export const SchemaProfileValidationRules = z.object({
  email: z.object({
    required: z.boolean().optional(),
    format: z.enum(["email"]).optional(),
  }).optional(),
  amount: z.object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  status: z.object({
    allowedValues: z.array(z.string()).optional(),
  }).optional(),
  identity: z.object({
    requireNameOrExternalId: z.boolean().optional(),
  }).optional(),
});

export const SchemaProfileCleanupRules = z.object({
  trimWhitespace: z.boolean().default(true),
  lowercaseEmails: z.boolean().default(true),
  coerceAmounts: z.boolean().default(true),
  normalizeStatus: z.boolean().default(true),
  collapseSpaces: z.boolean().default(true),
});

export const SchemaProfileDedupeStrategy = z.object({
  enabled: z.boolean().default(true),
  fields: z.array(z.string()).default(["email", "externalId", "name+company"]),
  action: z.enum(["skip", "update", "allow"]).default("skip"),
});

export const SchemaProfileConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Profile name is required"),
  requiredFields: z.array(z.string()).default([]),
  fieldMappings: z.record(z.string(), z.string()).default({
    "first_name": "name",
    "e_mail": "email",
    "email_address": "email",
    "customer_name": "name",
    "full_name": "name",
    "company_name": "company",
    "organization": "company",
    "value": "amount",
    "total": "amount",
    "type": "category",
    "segment": "category",
    "external_id": "externalId",
    "externalid": "externalId",
    "record_id": "externalId",
    "state": "status",
  }),
  cleanupRules: SchemaProfileCleanupRules.default({
    trimWhitespace: true,
    lowercaseEmails: true,
    coerceAmounts: true,
    normalizeStatus: true,
    collapseSpaces: true,
  }),
  validationRules: SchemaProfileValidationRules.default({
    email: { format: "email" },
    identity: { requireNameOrExternalId: true }
  }),
  dedupeStrategy: SchemaProfileDedupeStrategy.default({
    enabled: true,
    fields: ["email", "name+company"],
    action: "skip"
  }),
});

export type SchemaProfileConfig = z.infer<typeof SchemaProfileConfigSchema>;

export const DEFAULT_SCHEMA_PROFILE: SchemaProfileConfig = SchemaProfileConfigSchema.parse({
  name: "Default Profile",
});
