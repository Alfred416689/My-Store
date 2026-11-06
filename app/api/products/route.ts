import type { Filter, Sort } from "mongodb";
import { connection } from "next/server";
import {
  ensureProductCatalog,
  type CatalogProductDocument,
} from "@/app/lib/catalog";
import {
  getDatabase,
  getMongoConnectionErrorMessage,
} from "@/app/lib/mongodb";

const defaultPageSize = 12;
const maxPageSize = 24;
const maxPage = 10_000;

type SortBy = "featured" | "low" | "high" | "name" | "newest";

const sortOptions: Record<SortBy, Sort> = {
  featured: { featured: -1, id: 1 },
  low: { price: 1, id: 1 },
  high: { price: -1, id: -1 },
  name: { name: 1, id: 1 },
  newest: { id: -1 },
};

function isSortBy(value: string): value is SortBy {
  return value === "featured" || value === "low" || value === "high" ||
    value === "name" || value === "newest";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  await connection();

  const searchParams = new URL(request.url).searchParams;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("limit") ?? defaultPageSize);
  const category = searchParams.get("category")?.trim() ?? "";
  const search = searchParams.get("search")?.trim() ?? "";
  const sortBy = searchParams.get("sort") ?? "featured";
  const collection = searchParams.get("collection");

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > maxPage ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > maxPageSize ||
    category.length > 50 ||
    search.length > 100 ||
    (collection !== null && collection !== "everyday" && collection !== "curated") ||
    !isSortBy(sortBy)
  ) {
    return Response.json({ error: "Check the product filters and try again." }, { status: 400 });
  }

  const filter: Filter<CatalogProductDocument> = {};
  if (collection) filter.collections = collection;
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: expression }, { category: expression }];
  }
  const categoriesFilter = { ...filter };
  if (category) filter.category = category;

  try {
    const products = await ensureProductCatalog(await getDatabase());
    const matchingProducts = await products
      .find(filter, {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          price: 1,
          compareAtPrice: 1,
          category: 1,
          collections: 1,
          featured: 1,
          condition: 1,
          sizes: 1,
          image: 1,
          badge: 1,
          stock: 1,
        },
      })
      .sort(sortOptions[sortBy])
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .toArray();
    const categories = await products.distinct("category", categoriesFilter);
    const hasMore = matchingProducts.length > pageSize;

    return Response.json(
      {
        products: matchingProducts.slice(0, pageSize),
        categories,
        pagination: {
          page,
          pageSize,
          hasMore,
          nextPage: hasMore ? page + 1 : null,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Could not load the product catalog from MongoDB.", error);
    return Response.json(
      {
        error: getMongoConnectionErrorMessage(
          error,
          "The store is temporarily unavailable. Check the MongoDB connection.",
        ),
      },
      { status: 503 },
    );
  }
}
