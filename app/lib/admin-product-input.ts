import { Binary } from "mongodb";
import type { ProductCollection } from "@/app/lib/catalog";

const maxImageBytes = 5 * 1024 * 1024;
const maxBase64Length = 4 * Math.ceil(maxImageBytes / 3);

export type AdminProductInput = {
  name: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  collections: ProductCollection[];
  featured: boolean;
  condition: string;
  sizes: string[];
  stock: number;
  badge?: string;
  description: string;
  image?: { contentType: string; data: Binary };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length <= maxLength && (!required || text.length > 0) ? text : null;
}

function parseImage(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > maxBase64Length) return null;

  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > maxImageBytes) return null;
  return { contentType: match[1], data: new Binary(data) };
}

export function parseAdminProductInput(
  value: unknown,
  requireImage: boolean,
): AdminProductInput | null {
  if (!isRecord(value)) return null;

  const name = readText(value.name, 100, true);
  const category = readText(value.category, 50, true);
  const condition = readText(value.condition, 80, true);
  const description = readText(value.description, 1000, true);
  const badge = readText(value.badge, 40);
  const sizesText = readText(value.sizes, 120, true);
  const price = value.price;
  const compareAtPrice = value.compareAtPrice;
  const stock = value.stock;
  const collections = value.collections;
  const validCollections = Array.isArray(collections)
    ? collections.filter(
        (collection): collection is ProductCollection =>
          collection === "everyday" || collection === "curated",
      )
    : [];
  const image = value.image === undefined || value.image === null || value.image === ""
    ? undefined
    : parseImage(value.image) ?? null;
  const sizes = sizesText
    ?.split(",")
    .map((size) => size.trim())
    .filter(Boolean);

  if (
    name === null ||
    category === null ||
    condition === null ||
    description === null ||
    badge === null ||
    !sizes ||
    sizes.length === 0 ||
    sizes.length > 12 ||
    sizes.some((size) => size.length > 20) ||
    typeof price !== "number" ||
    !Number.isSafeInteger(price) ||
    price < 1 ||
    price > 1_000_000 ||
    (compareAtPrice !== undefined &&
      compareAtPrice !== null &&
      (typeof compareAtPrice !== "number" ||
        !Number.isSafeInteger(compareAtPrice) ||
        compareAtPrice <= price ||
        compareAtPrice > 1_000_000)) ||
    typeof stock !== "number" ||
    !Number.isSafeInteger(stock) ||
    stock < 0 ||
    stock > 10_000 ||
    typeof value.featured !== "boolean" ||
    !Array.isArray(collections) ||
    collections.length === 0 ||
    validCollections.length !== collections.length ||
    new Set(validCollections).size !== validCollections.length ||
    (requireImage && !image) ||
    image === null
  ) {
    return null;
  }

  return {
    name,
    category,
    price,
    ...(typeof compareAtPrice === "number" ? { compareAtPrice } : {}),
    collections: validCollections,
    featured: value.featured,
    condition,
    sizes,
    stock,
    ...(badge ? { badge } : {}),
    description,
    ...(image ? { image } : {}),
  };
}
