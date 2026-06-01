import { prisma } from "./db";

export async function getDashboardStats() {
  const [importTotals, successImports, failedImports, recordCount, latestImport, recentImports] =
    await Promise.all([
      prisma.importJob.aggregate({
        _count: { id: true },
        _sum: {
          totalRows: true,
          validRows: true,
          invalidRows: true,
          duplicateRows: true,
        },
      }),
      prisma.importJob.count({ where: { status: "imported" } }),
      prisma.importJob.count({ where: { status: "failed" } }),
      prisma.normalizedRecord.count(),
      prisma.importJob.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const totalRows = importTotals._sum.totalRows ?? 0;
  const validRows = importTotals._sum.validRows ?? 0;
  const invalidRows = importTotals._sum.invalidRows ?? 0;
  const duplicateRows = importTotals._sum.duplicateRows ?? 0;

  return {
    totalImports: importTotals._count.id,
    successImports,
    failedImports,
    totalRecords: recordCount,
    rejectedRows: invalidRows,
    duplicateRows,
    totalRows,
    validRows,
    qualityScore: totalRows ? validRows / totalRows : 0,
    latestImport,
    recentImports,
  };
}

export async function getAnalyticsData() {
  const [
    statusBreakdown,
    categoryBreakdown,
    companyBreakdown,
    errorBreakdown,
    importTotals,
    amountAgg,
  ] = await Promise.all([
    prisma.normalizedRecord.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.normalizedRecord.groupBy({
      by: ["category"],
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
      take: 8,
    }),
    prisma.normalizedRecord.groupBy({
      by: ["company"],
      _count: { company: true },
      orderBy: { _count: { company: "desc" } },
      take: 8,
    }),
    prisma.validationError.groupBy({
      by: ["field"],
      _count: { field: true },
      orderBy: { _count: { field: "desc" } },
      take: 8,
    }),
    prisma.importJob.aggregate({
      _count: { id: true },
      _sum: { totalRows: true, validRows: true, duplicateRows: true },
    }),
    prisma.normalizedRecord.aggregate({
      _sum: { amount: true },
      _avg: { amount: true },
    }),
  ]);

  const totalImports = importTotals._count.id;
  const totalRows = importTotals._sum.totalRows ?? 0;
  const validRows = importTotals._sum.validRows ?? 0;
  const duplicateRows = importTotals._sum.duplicateRows ?? 0;

  return {
    statusBreakdown,
    categoryBreakdown,
    companyBreakdown,
    errorBreakdown,
    importSuccessRate: totalRows ? validRows / totalRows : 0,
    duplicateRate: totalRows ? duplicateRows / totalRows : 0,
    totalAmount: amountAgg._sum.amount ?? 0,
    averageAmount: amountAgg._avg.amount ?? 0,
    totalImports,
  };
}
