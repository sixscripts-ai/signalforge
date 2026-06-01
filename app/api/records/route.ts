import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const importId = url.searchParams.get("importId")?.trim();

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (category) where.category = category;
  if (importId) where.importJobId = importId;

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { company: { contains: q } },
      { externalId: { contains: q } },
    ];
  }

  const records = await prisma.normalizedRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { importJob: true },
  });

  return Response.json({ records });
}
