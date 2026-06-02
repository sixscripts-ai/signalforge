import { db } from "@/lib/db";
import { importJob, normalizedRecord } from "@/lib/db/schema";
import { count, sum, avg, desc, eq, and, sql } from "drizzle-orm";
import { requireWorkspace } from "@/lib/auth";

export async function getDashboardStats() {
  const ws = await requireWorkspace();
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
        autoFixedRows: sum(importJob.autoFixedRows),
        needsReviewRows: sum(importJob.needsReviewRows),
        rejectedRows: sum(importJob.rejectedRows),
        duplicateRows: sum(importJob.duplicateRows),
      })
      .from(importJob)
      .where(eq(importJob.workspaceId, ws.id)),
    db
      .select({ count: count() })
      .from(importJob)
      .where(and(eq(importJob.status, "imported"), eq(importJob.workspaceId, ws.id))),
    db
      .select({ count: count() })
      .from(importJob)
      .where(and(eq(importJob.status, "failed"), eq(importJob.workspaceId, ws.id))),
    db.select({ count: count() }).from(normalizedRecord).where(eq(normalizedRecord.workspaceId, ws.id)),
    db.select().from(importJob).where(eq(importJob.workspaceId, ws.id)).orderBy(desc(importJob.createdAt)).limit(1),
    db.select().from(importJob).where(eq(importJob.workspaceId, ws.id)).orderBy(desc(importJob.createdAt)).limit(5),
  ]);

  const stats = importStats[0];
  const totalRows = Number(stats?.totalRows ?? 0);
  const validRows = Number(stats?.validRows ?? 0);
  const autoFixedRows = Number(stats?.autoFixedRows ?? 0);
  const needsReviewRows = Number(stats?.needsReviewRows ?? 0);
  const rejectedRows = Number(stats?.rejectedRows ?? 0);
  const duplicateRows = Number(stats?.duplicateRows ?? 0);
  // Quality includes both pristine valid rows and auto-fixed rows that passed validation
  const importedRows = validRows + autoFixedRows;

  return {
    totalImports: stats?.totalImports ?? 0,
    successImports: successCount[0]?.count ?? 0,
    failedImports: failedCount[0]?.count ?? 0,
    totalRecords: recordCount[0]?.count ?? 0,
    totalRows,
    validRows,
    autoFixedRows,
    needsReviewRows,
    rejectedRows,
    duplicateRows,
    importedRows,
    qualityScore: totalRows ? importedRows / totalRows : 0,
    latestImport: latestImport[0] ?? null,
    recentImports,
  };
}

export async function getAnalyticsData() {
  const ws = await requireWorkspace();
  const [
    statusBreakdown,
    categoryBreakdown,
    companyBreakdown,
    importStats,
    amountStats,
  ] = await Promise.all([
    db
      .select({
        status: normalizedRecord.status,
        _count: count(normalizedRecord.status),
      })
      .from(normalizedRecord)
      .where(eq(normalizedRecord.workspaceId, ws.id))
      .groupBy(normalizedRecord.status),
    db
      .select({
        category: normalizedRecord.category,
        _count: count(normalizedRecord.category),
      })
      .from(normalizedRecord)
      .where(eq(normalizedRecord.workspaceId, ws.id))
      .groupBy(normalizedRecord.category)
      .orderBy(sql`count(${normalizedRecord.category}) desc`)
      .limit(8),
    db
      .select({
        company: normalizedRecord.company,
        _count: count(normalizedRecord.company),
      })
      .from(normalizedRecord)
      .where(eq(normalizedRecord.workspaceId, ws.id))
      .groupBy(normalizedRecord.company)
      .orderBy(sql`count(${normalizedRecord.company}) desc`)
      .limit(8),
    db
      .select({
        totalImports: count(importJob.id),
        totalRows: sum(importJob.totalRows),
        validRows: sum(importJob.validRows),
        autoFixedRows: sum(importJob.autoFixedRows),
        needsReviewRows: sum(importJob.needsReviewRows),
        rejectedRows: sum(importJob.rejectedRows),
        duplicateRows: sum(importJob.duplicateRows),
      })
      .from(importJob)
      .where(eq(importJob.workspaceId, ws.id)),
    db
      .select({
        totalAmount: sum(normalizedRecord.amount),
        averageAmount: avg(normalizedRecord.amount),
      })
      .from(normalizedRecord)
      .where(eq(normalizedRecord.workspaceId, ws.id)),
  ]);

  const stats = importStats[0];
  const totalImports = stats?.totalImports ?? 0;
  const totalRows = Number(stats?.totalRows ?? 0);
  const validRows = Number(stats?.validRows ?? 0);
  const autoFixedRows = Number(stats?.autoFixedRows ?? 0);
  const needsReviewRows = Number(stats?.needsReviewRows ?? 0);
  const rejectedRows = Number(stats?.rejectedRows ?? 0);
  const duplicateRows = Number(stats?.duplicateRows ?? 0);
  const importedRows = validRows + autoFixedRows;

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
    errorBreakdown: [] as Array<{ field: string; _count: { field: number } }>,
    importSuccessRate: totalRows ? importedRows / totalRows : 0,
    duplicateRate: totalRows ? duplicateRows / totalRows : 0,
    rejectedRate: totalRows ? rejectedRows / totalRows : 0,
    totalAmount: Number(amountStats[0]?.totalAmount ?? 0),
    averageAmount: Number(amountStats[0]?.averageAmount ?? 0),
    totalImports,
    totalRows,
    validRows,
    autoFixedRows,
    needsReviewRows,
    rejectedRows,
    duplicateRows,
    importedRows,
  };
}
