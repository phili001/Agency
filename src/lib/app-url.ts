export function normalizeAppUrl(value?: string | null) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return "http://localhost:3000";
  }

  const withProtocol = /^https?:\/\//i.test(cleanValue)
    ? cleanValue
    : `https://${cleanValue}`;

  return withProtocol.replace(/\/$/, "");
}
