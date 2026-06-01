import { db } from "@/lib/db";
import { importJob, normalizedRecord, validationError } from "@/lib/db/schema";
import { count, sum, avg, desc, eq, sql } from "drizzle-orm";

export async function getDashboardStats() {
  const [
    importStats,
    successCount,
    failedCount,
    recordCount,
    latestImport,
    recentImports,
  ] = await Promise.all([
    db
      .select({
        totalImports: count(importJob.id),
        totalRows: sum(importJob.totalRows),
        validRows: sum(importJob.validRows),
        invalidRows: sum(importJob.invalidRows),
        duplicateRows: sum(importJob.duplicateRows),
      })
      .from(importJob),
    db
      .select({ count: count() })
      .from(importJob)
      .where(eq(importJob.status, "imported")),
    db
      .select({ count: count() })
      .from(importJob)
      .where(eq(importJob.status, "failed")),
    db.select({ count: count() }).from(normalizedRecord),
    db.select().from(importJob).orderBy(desc(importJob.createdAt)).limit(1),
    db.select().from(importJob).orderBy(desc(importJob.createdAt)).limit(5),
  ]);

  const stats = importStats[0];
  const totalRows = Number(stats?.totalRows ?? 0);
  const validRows = Number(stats?.validRows ?? 0);
  const invalidRows = Number(stats?.invalidRows ?? 0);
  const duplicateRows = Number(stats?.duplicateRows ?? 0);

  return {
    totalImports: stats?.totalImports ?? 0,
    successImports: successCount[0]?.count ?? 0,
    failedImports: failedCount[0]?.count ?? 0,
    totalRecords: recordCount[0]?.count ?? 0,
    rejectedRows: invalidRows,
    duplicateRows,
    totalRows,
    validRows,
    qualityScore: totalRows ? validRows / totalRows : 0,
    latestImport: latestImport[0] ?? null,
    recentImports,
  };
}

export async function getAnalyticsData() {
  const [
    statusBreakdown,
    categoryBreakdown,
    companyBreakdown,
    errorBreakdown,
    importStats,
    amountStats,
  ] = await Promise.all([
    db
      .select({
        status: normalizedRecord.status,
        _count: count(normalizedRecord.status),
      })
      .from(normalizedRecord)
      .groupBy(normalizedRecord.status),
    db
      .select({
        category: normalizedRecord.category,
        _count: count(normalizedRecord.category),
      })
      .from(normalizedRecord)
      .groupBy(normalizedRecord.category)
      .orderBy(sql`count(${normalizedRecord.category}) desc`)
      .limit(8),
    db
      .select({
        company: normalizedRecord.company,
        _count: count(normalizedRecord.company),
      })
      .from(normalizedRecord)
      .groupBy(normalizedRecord.company)
      .orderBy(sql`count(${normalizedRecord.company}) desc`)
      .limit(8),
    db
      .select({
        field: validationError.field,
        _count: count(validationError.field),
      })
      .from(validationError)
      .groupBy(validationError.field)
      .orderBy(sql`count(${validationError.field}) desc`)
      .limit(8),
    db
      .select({
        totalImports: count(importJob.id),
        totalRows: sum(importJob.totalRows),
        validRows: sum(importJob.validRows),
        duplicateRows: sum(importJob.duplicateRows),
      })
      .from(importJob),
    db
      .select({
        totalAmount: sum(normalizedRecord.amount),
        averageAmount: avg(normalizedRecord.amount),
      })
      .from(normalizedRecord),
  ]);

  const stats = importStats[0];
  const totalImports = stats?.totalImports ?? 0;
  const totalRows = Number(stats?.totalRows ?? 0);
  const validRows = Number(stats?.validRows ?? 0);
  const duplicateRows = Number(stats?.duplicateRows ?? 0);

  return {
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      _count: { status: s._count },
    })),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      _count: { category: c._count },
    })),
    companyBreakdown: companyBreakdown.map((c) => ({
      company: c.company,
      _count: { company: c._count },
    })),
    errorBreakdown: errorBreakdown.map((e) => ({
      field: e.field,
      _count: { field: e._count },
    })),
    importSuccessRate: totalRows ? validRows / totalRows : 0,
    duplicateRate: totalRows ? duplicateRows / totalRows : 0,
    totalAmount: Number(amountStats[0]?.totalAmount ?? 0),
    averageAmount: Number(amountStats[0]?.averageAmount ?? 0),
    totalImports,
  };
}
