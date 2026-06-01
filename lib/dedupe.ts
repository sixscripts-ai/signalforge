import type { NormalizedRow } from "./normalizer";

export function computeDedupeKey(
  row: NormalizedRow,
  fallback: string
): string {
  if (row.email) return `email:${row.email}`;
  if (row.externalId) return `external:${row.externalId}`;
  if (row.name && row.company) {
    return `name:${row.name.toLowerCase()}|company:${row.company.toLowerCase()}`;
  }
  if (row.name) return `name:${row.name.toLowerCase()}`;
  return `row:${fallback}`;
}

export function buildDedupeSet(existing: string[]) {
  return new Set(existing);
}
