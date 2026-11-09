import { connection } from "next/server";
import { serializeCatalogProduct } from "@/app/lib/catalog";
import {
  getSupabaseConnectionErrorMessage,
  createSupabaseServiceClient,
} from "@/app/lib/supabase";

const defaultPageSize = 12;
const maxPageSize = 24;
const maxPage = 10_000;

type SortBy = "featured" | "low" | "high" | "name" | "newest";

function isSortBy(value: string): value is SortBy {
  return value === "featured" || value === "low" || value === "high" ||
    value === "name" || value === "newest";
}

function normalizeSearch(value: string) {
  return value.replace(/[^\w -]/g, "").trim();
}

export async function GET(request: Request) {
  await connection();

  const searchParams = new URL(request.url).searchParams;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("limit") ?? defaultPageSize);
  const category = searchParams.get("category")?.trim() ?? "";
  const rawSearch = searchParams.get("search")?.trim() ?? "";
  const search = normalizeSearch(rawSearch);
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
    rawSearch.length > 100 ||
    (collection !== null && collection !== "everyday" && collection !== "curated") ||
    !isSortBy(sortBy)
  ) {
    return Response.json({ error: "Check the product filters and try again." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    let productsQuery = supabase
      .from("products")
      .select(
        "id,name,price,compare_at_price,category,collections,featured,condition,sizes,image,gallery,description,stock,badge",
        { count: "exact" },
      );
    let categoriesQuery = supabase.from("products").select("category");

    if (collection) {
      productsQuery = productsQuery.contains("collections", [collection]);
      categoriesQuery = categoriesQuery.contains("collections", [collection]);
    }
    if (search) {
      const filter = `name.ilike.%${search}%,category.ilike.%${search}%`;
      productsQuery = productsQuery.or(filter);
      categoriesQuery = categoriesQuery.or(filter);
    }
    if (category) productsQuery = productsQuery.eq("category", category);

    const ascending = sortBy === "low" || sortBy === "name";
    const sortColumn =
      sortBy === "featured" ? "featured" :
      sortBy === "low" || sortBy === "high" ? "price" :
      sortBy === "name" ? "name" : "id";
    const sortedProductsQuery = productsQuery
      .order(sortColumn, { ascending: sortBy === "newest" ? false : sortBy === "featured" ? false : ascending })
      .order("id", { ascending: sortBy !== "high" && sortBy !== "newest" });

    const [{ data: products, error: productsError, count }, { data: categoryRows, error: categoriesError }] =
      await Promise.all([
        sortedProductsQuery.range((page - 1) * pageSize, page * pageSize - 1),
        categoriesQuery.order("category"),
      ]);

    if (productsError) throw productsError;
    if (categoriesError) throw categoriesError;

    return Response.json(
      {
        products: (products ?? []).map(serializeCatalogProduct),
        categories: [...new Set((categoryRows ?? []).map((row) => row.category))],
        pagination: {
          page,
          pageSize,
          hasMore: (count ?? 0) > page * pageSize,
          nextPage: (count ?? 0) > page * pageSize ? page + 1 : null,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Could not load the product catalog from Supabase.", error);
    return Response.json(
      {
        error: getSupabaseConnectionErrorMessage(
          error,
          "The store is temporarily unavailable. Check the Supabase connection and database setup.",
        ),
      },
      { status: 503 },
    );
  }
}
