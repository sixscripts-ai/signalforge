import { db } from "./index";
import {
  importJob,
  rawRow,
  validationError,
  normalizedRecord,
  schemaProfile,
} from "./schema";
import {
  sampleCategories,
  sampleCompanies,
  sampleImportFiles,
  sampleNames,
  sampleStatuses,
} from "../demo-data";
import { computeDedupeKey } from "../dedupe";
import { mapFieldVariants, normalizeRow } from "../normalizer";
import { validateRow } from "../validators";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Cleaning database...");
  await db.delete(validationError);
  await db.delete(normalizedRecord);
  await db.delete(rawRow);
  await db.delete(importJob);
  await db.delete(schemaProfile);

  console.log("Seeding schema profile...");
  await db.insert(schemaProfile).values({
    id: nanoid(),
    name: "Default Profile",
    requiredFields: JSON.stringify(["name", "externalId"]),
    fieldMappings: JSON.stringify({
      "e-mail": "email",
      customer_name: "name",
      company_name: "company",
      value: "amount",
      type: "category",
    }),
    validationRules: JSON.stringify({
      email: "must be valid if present",
      amount: "numeric if present",
      identity: "name or externalId required",
    }),
    dedupeStrategy: JSON.stringify({ priority: ["email", "externalId", "name+company"] }),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const baseDate = new Date();
  const dedupeKeys = new Set<string>();

  const jobId = nanoid();
  console.log("Seeding import job...");
  
  await db.insert(importJob).values({
    id: jobId,
    filename: sampleImportFiles[0],
    sourceType: "csv",
    status: "imported",
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    createdAt: baseDate,
    completedAt: baseDate,
  });

  const rows = [
    buildBaseRow(0),
    buildBaseRow(1),
    buildInvalidRow("invalid-email"),
    buildBaseRow(3),
    buildBaseRow(4),
  ];

  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  console.log("Seeding records...");
  for (let i = 0; i < rows.length; i += 1) {
    const rowIndex = i + 1;
    const rawData = rows[i];
    const mapped = mapFieldVariants(rawData);
    const normalized = normalizeRow(mapped);
    const validation = validateRow(rowIndex, mapped, normalized);

    let rowStatus = validation.status === "invalid" ? "invalid" : "valid";
    const dedupeKey = computeDedupeKey(normalized, `${jobId}-${rowIndex}`);
    if (rowStatus === "valid") {
      if (dedupeKeys.has(dedupeKey)) {
        rowStatus = "duplicate";
      } else {
        dedupeKeys.add(dedupeKey);
      }
    }

    if (rowStatus === "valid") validRows += 1;
    if (rowStatus === "invalid") invalidRows += 1;
    if (rowStatus === "duplicate") duplicateRows += 1;

    const rowId = nanoid();
    await db.insert(rawRow).values({
      id: rowId,
      importJobId: jobId,
      rowIndex,
      rawData: JSON.stringify(rawData),
      status: rowStatus,
      errorSummary: validation.errors.map((e) => e.message).join(" | ") || null,
      createdAt: baseDate,
    });

    if (validation.errors.length) {
      for (const err of validation.errors) {
        await db.insert(validationError).values({
          id: nanoid(),
          importJobId: jobId,
          rawRowId: rowId,
          rowIndex,
          field: err.field,
          message: err.message,
          severity: "error",
          createdAt: baseDate,
        });
      }
    }

    if (rowStatus === "valid") {
      await db.insert(normalizedRecord).values({
        id: nanoid(),
        importJobId: jobId,
        externalId: normalized.externalId ?? null,
        name: normalized.name ?? null,
        email: normalized.email ?? null,
        company: normalized.company ?? null,
        category: normalized.category ?? null,
        amount: normalized.amount ?? null,
        status: normalized.status ?? null,
        dedupeKey,
        sourceRowIndex: rowIndex,
        createdAt: baseDate,
      });
    }
  }

  console.log("Updating import job stats...");
  await db.update(importJob).set({
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
  }).where(eq(importJob.id, jobId));

  console.log("Seed complete!");
  process.exit(0);
}

function buildBaseRow(index: number) {
  const name = sampleNames[index % sampleNames.length];
  const company = sampleCompanies[index % sampleCompanies.length];
  const category = sampleCategories[index % sampleCategories.length];
  const status = sampleStatuses[index % sampleStatuses.length];
  const amount = (1200 + index * 17).toFixed(2);

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
