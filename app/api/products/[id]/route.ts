import { connection } from "next/server";
import { ensureProductCatalog } from "@/app/lib/catalog";
import {
  getDatabase,
  getMongoConnectionErrorMessage,
} from "@/app/lib/mongodb";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  await connection();

  try {
    const products = await ensureProductCatalog(await getDatabase());
    const product = await products.findOne(
      { id: Number(id) },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          price: 1,
          category: 1,
          condition: 1,
          sizes: 1,
          image: 1,
          gallery: 1,
          badge: 1,
          stock: 1,
          description: 1,
        },
      },
    );

    if (!product) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }

    return Response.json(
      { product },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Could not load product details from MongoDB.", error);
    return Response.json(
      {
        error: getMongoConnectionErrorMessage(
          error,
          "Product details are temporarily unavailable. Check the MongoDB connection.",
        ),
      },
      { status: 503 },
    );
  }
}
