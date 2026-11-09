import { connection } from "next/server";
import { serializeCatalogProduct } from "@/app/lib/catalog";
import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
} from "@/app/lib/supabase";

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
    const { data: product, error } = await createSupabaseServiceClient()
      .from("products")
      .select("id,name,price,compare_at_price,category,collections,featured,condition,sizes,image,gallery,image_path,description,stock,badge")
      .eq("id", Number(id))
      .maybeSingle();

    if (error) throw error;
    if (!product) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }

    return Response.json(
      { product: serializeCatalogProduct(product) },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Could not load product details from Supabase.", error);
    return Response.json(
      {
        error: getSupabaseConnectionErrorMessage(
          error,
          "Product details are temporarily unavailable. Check the Supabase connection.",
        ),
      },
      { status: 503 },
    );
  }
}
