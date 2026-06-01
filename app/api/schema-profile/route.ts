import { db } from "@/lib/db";
import { schemaProfile } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const profiles = await db
    .select()
    .from(schemaProfile)
    .orderBy(desc(schemaProfile.createdAt))
    .limit(1);

  const profile = profiles[0] ?? null;

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
