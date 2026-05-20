/** RFC4180 風の CSV フィールドエスケープ */

export function escapeCsvField(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function rowToCsvLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}
