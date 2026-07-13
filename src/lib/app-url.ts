export function normalizeAppUrl(value?: string | null) {
  const cleanValue = value?.trim();
  const canonicalUrl = "https://agentelevi.com";

  if (!cleanValue) {
    return canonicalUrl;
  }

  const withProtocol = /^https?:\/\//i.test(cleanValue)
    ? cleanValue
    : `https://${cleanValue}`;
  const url = withProtocol.replace(/\/$/, "");

  return url.includes(".vercel.app") ? canonicalUrl : url;
}
