import { connection } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import { parseAdminProductInput } from "@/app/lib/admin-product-input";
import { ensureProductCatalog } from "@/app/lib/catalog";
import {
  getDatabase,
  getMongoConnectionErrorMessage,
} from "@/app/lib/mongodb";
import {
  InvalidJsonBodyError,
  PayloadTooLargeError,
  readJsonBody,
} from "@/app/lib/request-body";

const maxRequestBytes = 7 * 1024 * 1024;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSession())) {
    return errorResponse("Sign in to edit products.", 401);
  }

  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return errorResponse("Product not found.", 404);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("Send the product details as JSON.", 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, maxRequestBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return errorResponse("The product image must be 5 MB or smaller.", 413);
    }
    if (error instanceof InvalidJsonBodyError) {
      return errorResponse("The product details must be valid JSON.", 400);
    }
    console.error("Could not read the edited product details.", error);
    return errorResponse("The product details could not be read.", 400);
  }

  const productInput = parseAdminProductInput(body, false);
  if (!productInput) {
    return errorResponse("Check all product fields and choose at least one collection.", 400);
  }

  await connection();
  try {
    const products = await ensureProductCatalog(await getDatabase());
    const imageUrl = `/api/products/${id}/image`;
    const { image, ...productFields } = productInput;
    const setFields = {
      ...productFields,
      ...(image ? { image: imageUrl, gallery: [imageUrl], imageData: image } : {}),
    };
    const update = await products.updateOne(
      { id: Number(id) },
      {
        $set: setFields,
        $unset: {
          ...(productInput.compareAtPrice === undefined ? { compareAtPrice: "" } : {}),
          ...(productInput.badge === undefined ? { badge: "" } : {}),
        },
      },
    );
    if (!update.matchedCount) return errorResponse("Product not found.", 404);

    return Response.json({
      product: {
        id: Number(id),
        ...productFields,
        ...(image ? { image: imageUrl, gallery: [imageUrl] } : {}),
      },
    });
  } catch (error) {
    console.error("Could not update the product in MongoDB.", error);
    return errorResponse(
      getMongoConnectionErrorMessage(
        error,
        "The product could not be saved. Check the MongoDB connection and try again.",
      ),
      503,
    );
  }
}
