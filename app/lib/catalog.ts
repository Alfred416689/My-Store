import {
  Binary,
  type Collection,
  type Db,
  type Document,
} from "mongodb";
import defaultProducts from "@/data/products.json";

export type CatalogProductDocument = Document & {
  id: number;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  collections?: ProductCollection[];
  featured?: boolean;
  condition: string;
  sizes: string[];
  image: string;
  gallery: string[];
  description: string;
  stock: number;
  badge?: string;
  imageData?: { contentType: string; data: Binary };
};

export type ProductCollection = "everyday" | "curated";

const catalogByDatabase = new WeakMap<
  Db,
  Promise<Collection<CatalogProductDocument>>
>();

export function ensureProductCatalog(database: Db) {
  let catalog = catalogByDatabase.get(database);
  if (!catalog) {
    catalog = initializeProductCatalog(database);
    catalogByDatabase.set(database, catalog);
    void catalog.catch(() => catalogByDatabase.delete(database));
  }
  return catalog;
}

async function initializeProductCatalog(database: Db) {
  const products = database.collection<CatalogProductDocument>("products");
  await Promise.all([
    products.createIndex({ id: 1 }, { unique: true }),
    products.createIndex({ price: 1, id: 1 }),
    products.createIndex({ name: 1, id: 1 }),
    products.createIndex({ category: 1, id: 1 }),
  ]);
  await products.bulkWrite(
    defaultProducts.map((product) => ({
      updateOne: {
        filter: { id: product.id },
        update: {
          $setOnInsert: {
            ...product,
            collections: ["everyday"],
            featured: false,
          },
        },
        upsert: true,
      },
    })),
  );
  await products.bulkWrite(
    defaultProducts.map((product) => ({
      updateOne: {
        filter: { id: product.id, sizes: { $not: { $type: "array" } } },
        update: { $set: { sizes: product.sizes } },
      },
    })),
  );
  await products.updateMany(
    { collections: { $exists: false } },
    { $set: { collections: ["everyday"], featured: false } },
  );

  return products;
}
