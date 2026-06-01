import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const importJob = await prisma.importJob.findUnique({
    where: { id },
    include: {
      rawRows: { orderBy: { rowIndex: "asc" }, take: 50 },
      validationErrors: { orderBy: { rowIndex: "asc" }, take: 100 },
      records: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!importJob) {
    return Response.json({ error: "Import not found." }, { status: 404 });
  }

  const safeParse = (v: string | null) => {
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return v;
    }
  };

  const parsed = {
    ...importJob,
    rawRows: importJob.rawRows.map((r) => ({ ...r, rawData: safeParse(r.rawData as unknown as string) })),
  };

  return Response.json({ import: parsed });
}
