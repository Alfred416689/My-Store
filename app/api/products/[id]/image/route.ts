import { Binary } from "mongodb";
import { connection } from "next/server";
import { getDatabase, getMongoConnectionErrorMessage } from "@/app/lib/mongodb";

type ProductImageDocument = {
  id: number;
  imageData?: { contentType: string; data: Binary };
};

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
    const product = await (await getDatabase())
      .collection<ProductImageDocument>("products")
      .findOne({ id: Number(id) }, { projection: { imageData: 1 } });

    if (!product?.imageData) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(Buffer.from(product.imageData.data.value()), {
      headers: {
        "Content-Type": product.imageData.contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Could not load a product image from MongoDB.", error);
    return new Response(
      getMongoConnectionErrorMessage(error, "Image unavailable"),
      { status: 503 },
    );
  }
}
