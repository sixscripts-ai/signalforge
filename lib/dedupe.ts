import type { NormalizedRow } from "./normalizer";

export function computeDedupeKey(
  row: NormalizedRow,
  fallback: string,
  fields: string[]
): string {
  for (const field of fields) {
    if (field === "email" && row.email) return `email:${row.email}`;
    if (field === "externalId" && row.externalId) return `external:${row.externalId}`;
    if (field === "name+company" && row.name && row.company) {
      return `name:${row.name.toLowerCase()}|company:${row.company.toLowerCase()}`;
    }
    if (field === "name" && row.name) return `name:${row.name.toLowerCase()}`;
  }
  return `row:${fallback}`;
}

export function buildDedupeSet(existing: string[]) {
  return new Set(existing);
}
