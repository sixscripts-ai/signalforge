import { prisma } from "@/lib/db";
import { MAX_ROW_COUNT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { parseImportFile } from "@/lib/parser";
import { mapFieldVariants, normalizeRow } from "@/lib/normalizer";
import { validateRow } from "@/lib/validators";
import { computeDedupeKey } from "@/lib/dedupe";

export async function GET() {
  const imports = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ imports });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "File is required." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit.` },
      { status: 413 }
    );
  }

  const content = await file.text();

  let parsed;
  try {
    parsed = parseImportFile({
      filename: file.name,
      content,
      mimeType: file.type,
      maxRows: MAX_ROW_COUNT,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Parse failed." },
      { status: 400 }
    );
  }

  const importJob = await prisma.importJob.create({
    data: {
      filename: file.name,
      sourceType: parsed.sourceType,
      status: "parsing",
      totalRows: parsed.rows.length,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
    },
  });

  try {
    const existingKeys = await prisma.normalizedRecord.findMany({
      select: { dedupeKey: true },
    });
    const dedupeSet = new Set(existingKeys.map((row) => row.dedupeKey));

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    for (let i = 0; i < parsed.rows.length; i += 1) {
      const rowIndex = i + 1;
      const rawRow = parsed.rows[i];
      const mapped = mapFieldVariants(rawRow);
      const normalized = normalizeRow(mapped);
      const validation = validateRow(rowIndex, mapped, normalized);

      let status: string = validation.status === "invalid" ? "invalid" : "valid";

      const dedupeKey = computeDedupeKey(normalized, `${importJob.id}-${rowIndex}`);
      if (status === "valid") {
        if (dedupeSet.has(dedupeKey)) {
          status = "duplicate";
        } else {
          dedupeSet.add(dedupeKey);
        }
      }

      if (status === "valid") validRows += 1;
      if (status === "invalid") invalidRows += 1;
      if (status === "duplicate") duplicateRows += 1;

      const rawRecord = await prisma.rawRow.create({
        data: {
          importJobId: importJob.id,
          rowIndex,
          rawData: JSON.stringify(rawRow),
          status,
          errorSummary:
            status === "invalid"
              ? validation.errors.map((err) => err.message).join(" | ")
              : status === "duplicate"
              ? "Duplicate detected"
              : null,
        },
      });

      if (validation.errors.length > 0) {
        for (const err of validation.errors) {
          await prisma.validationError.create({
            data: {
              importJobId: importJob.id,
              rawRowId: rawRecord.id,
              rowIndex,
              field: err.field,
              message: err.message,
              severity: err.severity,
            },
          });
        }
      }

      if (status === "valid") {
        await prisma.normalizedRecord.create({
          data: {
            importJobId: importJob.id,
            externalId: normalized.externalId ?? null,
            name: normalized.name ?? null,
            email: normalized.email ?? null,
            company: normalized.company ?? null,
            category: normalized.category ?? null,
            amount: normalized.amount ?? null,
            status: normalized.status ?? null,
            dedupeKey,
            sourceRowIndex: rowIndex,
          },
        });
      }
    }

    const updated = await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: "imported",
        validRows,
        invalidRows,
        duplicateRows,
        completedAt: new Date(),
      },
    });

    return Response.json({
      import: updated,
      warnings: parsed.warnings ?? [],
    });
  } catch (error) {
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Import failed.",
        completedAt: new Date(),
      },
    });

    return Response.json(
      { error: "Import failed while processing rows." },
      { status: 500 }
    );
  }
}
