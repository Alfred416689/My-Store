export type ProductCollection = "everyday" | "curated";

export type CatalogProductRow = {
  id: number;
  name: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  collections: ProductCollection[];
  featured: boolean;
  condition: string;
  sizes: string[];
  image: string;
  gallery: string[];
  image_path: string | null;
  description: string;
  stock: number;
  badge: string | null;
};

export function serializeCatalogProduct(
  product: Omit<CatalogProductRow, "image_path">,
) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    ...(product.compare_at_price === null
      ? {}
      : { compareAtPrice: product.compare_at_price }),
    category: product.category,
    collections: product.collections,
    featured: product.featured,
    condition: product.condition,
    sizes: product.sizes,
    image: product.image,
    gallery: product.gallery,
    description: product.description,
    stock: product.stock,
    ...(product.badge ? { badge: product.badge } : {}),
  };
}
