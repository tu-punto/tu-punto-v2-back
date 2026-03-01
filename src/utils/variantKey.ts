import crypto from "crypto";

type VariantValue = string | number | boolean | null | undefined;

type VariantsInput =
  | Map<string, VariantValue>
  | Record<string, VariantValue>
  | null
  | undefined;

const normalizeText = (value: VariantValue): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const variantsToEntries = (variantes: VariantsInput): [string, string][] => {
  if (!variantes) return [];

  const rawEntries =
    variantes instanceof Map
      ? Array.from(variantes.entries())
      : Object.entries(variantes);

  return rawEntries
    .map(([key, value]) => [normalizeText(key), normalizeText(value)] as [string, string])
    .filter(([key, value]) => key.length > 0 && value.length > 0);
};

export const variantFingerprint = (variantes: VariantsInput): string => {
  return variantsToEntries(variantes)
    .map(([key, value]) => [key.toLowerCase(), value.toLowerCase()] as [string, string])
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
};

export const variantLabel = (variantes: VariantsInput): string => {
  return variantsToEntries(variantes)
    .map(([_, value]) => value)
    .join(" / ");
};

export const createVariantKey = (productId: string, variantes: VariantsInput): string => {
  const fingerprint = variantFingerprint(variantes);
  const digest = crypto
    .createHash("sha1")
    .update(`${productId}|${fingerprint}`)
    .digest("hex")
    .slice(0, 12);

  return `vk_${digest}`;
};

