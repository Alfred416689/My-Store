import { connection } from "next/server";
import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
  supabaseStorageBucket,
} from "@/app/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return new Response("Not found", { status: 404 });
  }

  await connection();

  try {
    const supabase = createSupabaseServiceClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", Number(id))
      .maybeSingle();

    if (productError) throw productError;
    if (!product?.image_path) return new Response("Not found", { status: 404 });

    const { data: image, error: imageError } = await supabase.storage
      .from(supabaseStorageBucket)
      .download(product.image_path);
    if (imageError) throw imageError;

    return new Response(image, {
      headers: {
        "Content-Type": image.type || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Could not load a product image from Supabase.", error);
    return new Response(
      getSupabaseConnectionErrorMessage(error, "Image unavailable"),
      { status: 503 },
    );
  }
}
