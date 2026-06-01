import { prisma } from "@/lib/db";

export async function GET() {
  const profile = await prisma.schemaProfile.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!profile) return Response.json({ profile: null });

  const safeParse = (v: string | null) => {
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  };

  const parsed = {
    ...profile,
    requiredFields: safeParse(profile.requiredFields),
    fieldMappings: safeParse(profile.fieldMappings),
    validationRules: safeParse(profile.validationRules),
    dedupeStrategy: safeParse(profile.dedupeStrategy),
  };

  return Response.json({ profile: parsed });
}
