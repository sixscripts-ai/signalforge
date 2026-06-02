import { db } from "./index";
import {
  importJob,
  importRow,
  normalizedRecord,
  schemaProfile,
  workspace,
  workspaceMember,
  workspaceInvitation,
  importTemplate,
  auditLog,
} from "./schema";
import {
  sampleCategories,
  sampleCompanies,
  sampleImportFiles,
  sampleNames,
  sampleStatuses,
} from "../demo-data";
import { processRows } from "../pipeline";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { DEFAULT_SCHEMA_PROFILE, SchemaProfileConfigSchema } from "../schema-profile";

async function main() {
  console.log("Cleaning database...");
  await db.delete(normalizedRecord);
  await db.delete(importRow);
  await db.delete(importJob);
  await db.delete(importTemplate);
  await db.delete(schemaProfile);
  await db.delete(workspaceInvitation);
  await db.delete(workspaceMember);
  await db.delete(workspace);

  console.log("Seeding workspace...");
  const workspaceId = nanoid();
  await db.insert(workspace).values({
    id: workspaceId,
    name: "Demo Workspace",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const dummyUserId = "user_demo123";
  await db.insert(workspaceMember).values([
    {
      id: nanoid(),
      workspaceId,
      userId: dummyUserId,
      role: "owner",
      createdAt: new Date(),
    },
    {
      id: nanoid(),
      workspaceId,
      userId: "user_colleague456",
      role: "admin",
      createdAt: new Date(),
    }
  ]);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(workspaceInvitation).values({
    id: nanoid(),
    workspaceId,
    email: "newhire@example.com",
    role: "member",
    token: nanoid(32),
    status: "pending",
    invitedByUserId: dummyUserId,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("Seeding schema profile...");
  const profileId = nanoid();
  const profile = { ...DEFAULT_SCHEMA_PROFILE, id: profileId };

  await db.insert(schemaProfile).values({
    id: profileId,
    workspaceId,
    name: profile.name,
    requiredFields: profile.requiredFields,
    fieldMappings: profile.fieldMappings,
    cleanupRules: profile.cleanupRules,
    validationRules: profile.validationRules,
    dedupeStrategy: profile.dedupeStrategy,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("Seeding import templates...");
  const parsedProfile = SchemaProfileConfigSchema.parse(profile);
  const templateSeedDate = new Date();

  const crmTemplateId = nanoid();
  await db.insert(importTemplate).values({
    id: crmTemplateId,
    workspaceId,
    name: "Default CRM Upload",
    description: "Standard import template for CSV exports from CRM platforms.",
    schemaProfileId: profileId,
    config: parsedProfile,
    sampleHeaders: ["first_name", "e-mail", "company_name", "value", "type", "status"],
    isDefault: "true",
    createdByUserId: dummyUserId,
    createdAt: templateSeedDate,
    updatedAt: templateSeedDate,
  });

  const hubspotTemplateId = nanoid();
  await db.insert(importTemplate).values({
    id: hubspotTemplateId,
    workspaceId,
    name: "HubSpot Export",
    description: "Configured for HubSpot contacts exports with standard HubSpot column names.",
    schemaProfileId: profileId,
    config: {
      ...parsedProfile,
      fieldMappings: {
        ...parsedProfile.fieldMappings,
        "First Name": "name",
        "Last Name": "name",
        "Email": "email",
        "Company": "company",
        "Phone": "externalId",
        "Deal Amount": "amount",
        "Lifecycle Stage": "status",
        "Industry": "category",
      },
      dedupeStrategy: {
        ...parsedProfile.dedupeStrategy,
        fields: ["email"],
      },
    },
    sampleHeaders: ["First Name", "Last Name", "Email", "Company", "Phone", "Deal Amount", "Lifecycle Stage", "Industry"],
    isDefault: "false",
    createdByUserId: dummyUserId,
    createdAt: templateSeedDate,
    updatedAt: templateSeedDate,
  });

  const baseDate = new Date();
  const jobId = nanoid();

  console.log("Seeding import job...");
  await db.insert(importJob).values({
    id: jobId,
    workspaceId,
    filename: sampleImportFiles[0],
    sourceType: "csv",
    status: "imported",
    totalRows: 0,
    validRows: 0,
    autoFixedRows: 0,
    needsReviewRows: 0,
    duplicateRows: 0,
    rejectedRows: 0,
    createdAt: baseDate,
    completedAt: baseDate,
    schemaProfileSnapshot: profile,
  });

  const rawDataPayload = [
    buildBaseRow(0), // Valid — numeric amount, clean data
    buildBaseRow(3), // Valid — numeric amount, clean data
    {
      "e-mail": " ADA@EXAMPLE.COM ",
      customer_name: "Ada Lovelace",
      company_name: "Analytical Engines",
      value: "$1,200",
      type: "Lead",
      status: "Active"
    }, // Auto-fixed — messy email, currency string, status casing
    buildInvalidRow("invalid-email"), // Rejected — bad email + missing name
    buildInvalidRow("amount-nan"), // Needs review — amount "N/A" produces warning
    buildBaseRow(4), // Valid — numeric amount, clean data
    buildBaseRow(0), // Duplicate — same as row 0
  ];

  console.log("Processing rows...");
  const { rows, summary } = processRows(rawDataPayload, undefined, profile);

  console.log("Seeding records...");
  for (const row of rows) {
    const rowId = nanoid();
    
    const allIssues = [
      ...row.issues,
      ...row.validationErrors.map((ve) => ({
        field: ve.field,
        message: ve.message,
        severity: ve.severity,
      })),
    ];

    await db.insert(importRow).values({
      id: rowId,
      workspaceId,
      importJobId: jobId,
      rowIndex: row.rowIndex,
      status: row.status,
      originalData: JSON.stringify(row.original),
      cleanedData: JSON.stringify(row.cleaned),
      issues: JSON.stringify(allIssues),
      createdAt: baseDate,
    });

    if (row.status === "valid" || row.status === "auto_fixed") {
      await db.insert(normalizedRecord).values({
        id: nanoid(),
        workspaceId,
        importJobId: jobId,
        externalId: (row.cleaned.externalId as string) ?? null,
        name: (row.cleaned.name as string) ?? null,
        email: (row.cleaned.email as string) ?? null,
        company: (row.cleaned.company as string) ?? null,
        category: (row.cleaned.category as string) ?? null,
        amount: (row.cleaned.amount as number) ?? null,
        status: (row.cleaned.status as string) ?? null,
        dedupeKey: row.dedupeKey,
        sourceRowIndex: row.rowIndex,
        createdAt: baseDate,
      });
    }
  }

  console.log("Updating import job stats...");
  await db.update(importJob).set({
    totalRows: summary.total,
    validRows: summary.valid,
    autoFixedRows: summary.autoFixed,
    needsReviewRows: summary.needsReview,
    rejectedRows: summary.rejected,
    duplicateRows: summary.duplicate,
  }).where(eq(importJob.id, jobId));

  console.log("Seeding audit log entries...");
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);

  await db.insert(auditLog).values([
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "workspace.created",
      entityType: "workspace",
      entityId: workspaceId,
      summary: 'Workspace "Demo Workspace" created',
      metadata: { name: "Demo Workspace" },
      createdAt: hoursAgo(48),
    },
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "schema_profile.updated",
      entityType: "schema_profile",
      entityId: profileId,
      summary: 'Created schema profile "Default CRM Import"',
      metadata: { profileName: "Default CRM Import" },
      createdAt: hoursAgo(47),
    },
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "import.previewed",
      entityType: "import",
      summary: `Previewed "${sampleImportFiles[0]}" — ${summary.total} rows (${summary.valid} valid, ${summary.rejected} rejected)`,
      metadata: {
        filename: sampleImportFiles[0],
        totalRows: summary.total,
        validRows: summary.valid,
        rejectedRows: summary.rejected,
      },
      createdAt: hoursAgo(24),
    },
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "import.confirmed",
      entityType: "import",
      entityId: jobId,
      summary: `Confirmed import "${sampleImportFiles[0]}" — ${summary.valid} valid, ${summary.autoFixed} auto-fixed, ${summary.rejected} rejected, ${summary.duplicate} duplicate`,
      metadata: {
        filename: sampleImportFiles[0],
        totalRows: summary.total,
        validRows: summary.valid,
        autoFixedRows: summary.autoFixed,
        rejectedRows: summary.rejected,
        duplicateRows: summary.duplicate,
      },
      createdAt: hoursAgo(23),
    },
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "records.exported",
      entityType: "export",
      summary: `Exported ${summary.valid + summary.autoFixed} records as CSV`,
      metadata: {
        scope: "records",
        format: "csv",
        rowCount: summary.valid + summary.autoFixed,
      },
      createdAt: hoursAgo(2),
    },
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "member.invited",
      entityType: "invitation",
      summary: "Invited newhire@example.com as member",
      metadata: { email: "newhire@example.com", role: "member" },
      createdAt: hoursAgo(1),
    },
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "import_template.created",
      entityType: "import_template",
      entityId: crmTemplateId,
      summary: 'Created import template "Default CRM Upload"',
      metadata: { templateName: "Default CRM Upload" },
      createdAt: hoursAgo(46),
    },
    {
      id: nanoid(),
      workspaceId,
      actorUserId: dummyUserId,
      actorEmail: "demo@signalforge.dev",
      action: "import_template.created",
      entityType: "import_template",
      entityId: hubspotTemplateId,
      summary: 'Created import template "HubSpot Export"',
      metadata: { templateName: "HubSpot Export" },
      createdAt: hoursAgo(45),
    },
  ]);

  console.log("Seed complete!");
  process.exit(0);
}

function buildBaseRow(index: number) {
  const name = sampleNames[index % sampleNames.length];
  const company = sampleCompanies[index % sampleCompanies.length];
  const category = sampleCategories[index % sampleCategories.length];
  const status = sampleStatuses[index % sampleStatuses.length];
  const amount = 1200 + index * 17;

  return {
    external_id: `EXT-${1000 + index}`,
    customer_name: name,
    "e-mail": `${name.split(" ")[0].toLowerCase()}${index}@${company
      .split(" ")[0]
      .toLowerCase()}.com`,
    company_name: company,
    type: category,
    value: amount,
    status,
  };
}

function buildInvalidRow(type: "invalid-email" | "missing-identity" | "amount-nan") {
  if (type === "invalid-email") {
    return {
      external_id: "EXT-9999",
      customer_name: "",
      "e-mail": "not-an-email",
      company_name: sampleCompanies[0],
      type: "lead",
      value: "720.00",
      status: "new",
    };
  }

  if (type === "amount-nan") {
    return {
      external_id: "EXT-8888",
      customer_name: "Riley Park",
      "e-mail": "riley.park@signalgrid.com",
      company_name: sampleCompanies[1],
      type: "sales",
      value: "N/A",
      status: "pending",
    };
  }

  return {
    external_id: "",
    customer_name: "",
    "e-mail": "orphan@relaydata.com",
    company_name: sampleCompanies[2],
    type: "support",
    value: "130.00",
    status: "open",
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
