export type NormalizedRow = {
  externalId?: string;
  name?: string;
  email?: string;
  company?: string;
  category?: string;
  amount?: number;
  status?: string;
};

export function mapFieldVariants(
  row: Record<string, unknown>,
  fieldMappings: Record<string, string>
) {
  const mapped: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    const canonical = fieldMappings[normalized] ?? normalized;
    mapped[canonical] = value;
  });
  return mapped;
}

export function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
