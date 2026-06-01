export type NormalizedRow = {
  externalId?: string;
  name?: string;
  email?: string;
  company?: string;
  category?: string;
  amount?: number;
  status?: string;
};

const KEY_ALIASES: Record<string, string> = {
  "e-mail": "email",
  "email_address": "email",
  "customer_name": "name",
  "full_name": "name",
  "company_name": "company",
  "organization": "company",
  "value": "amount",
  "total": "amount",
  "type": "category",
  "segment": "category",
  "external_id": "externalId",
  "externalid": "externalId",
  "record_id": "externalId",
  "state": "status",
};

export function mapFieldVariants(row: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    const canonical = KEY_ALIASES[normalized] ?? normalized;
    mapped[canonical] = value;
  });
  return mapped;
}

export function normalizeRow(row: Record<string, unknown>): NormalizedRow {
  const mapped = mapFieldVariants(row);

  return {
    externalId: normalizeString(mapped.externalId),
    name: normalizeString(mapped.name),
    email: normalizeEmail(mapped.email),
    company: normalizeString(mapped.company),
    category: normalizeString(mapped.category),
    amount: normalizeAmount(mapped.amount),
    status: normalizeStatus(mapped.status),
  };
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof value === "number") return String(value);
  return undefined;
}

function normalizeEmail(value: unknown) {
  const stringValue = normalizeString(value);
  return stringValue ? stringValue.toLowerCase() : undefined;
}

function normalizeStatus(value: unknown) {
  const stringValue = normalizeString(value);
  return stringValue ? stringValue.toLowerCase() : undefined;
}

function normalizeAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
