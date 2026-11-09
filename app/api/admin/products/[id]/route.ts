import { randomUUID } from "node:crypto";
import { getAdminSession, isAdminConfigurationReady } from "@/app/lib/admin-auth";
import { parseAdminProductInput } from "@/app/lib/admin-product-input";
import { serializeCatalogProduct } from "@/app/lib/catalog";
import { getImageExtension, removeImage, uploadImage } from "@/app/lib/storage";
import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
} from "@/app/lib/supabase";
import {
  InvalidJsonBodyError,
  PayloadTooLargeError,
  readJsonBody,
} from "@/app/lib/request-body";

const maxRequestBytes = 7 * 1024 * 1024;
const productFields =
  "id,name,price,compare_at_price,category,collections,featured,condition,sizes,image,gallery,description,stock,badge";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminConfigurationReady()) {
    return errorResponse("Supabase Auth and ADMIN_EMAIL must be configured.", 503);
  }

  try {
    if (!(await getAdminSession())) {
      return errorResponse("Sign in to edit products.", 401);
    }
  } catch (error) {
    console.error("Could not verify the admin session for product editing.", error);
    return errorResponse(
      getSupabaseConnectionErrorMessage(error, "The admin session could not be verified."),
      503,
    );
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

  const productId = Number(id);
  let uploadedPath: string | undefined;
  try {
    const supabase = createSupabaseServiceClient();
    const { data: currentProduct, error: currentError } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", productId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!currentProduct) return errorResponse("Product not found.", 404);

    const { image, ...fields } = productInput;
    const imageUrl = `/api/products/${productId}/image`;
    if (image) {
      uploadedPath = `products/${productId}/${randomUUID()}.${getImageExtension(image.contentType)}`;
      await uploadImage(uploadedPath, image.contentType, image.data);
    }

    const { data: product, error: updateError } = await supabase
      .from("products")
      .update({
        name: fields.name,
        price: fields.price,
        compare_at_price: fields.compareAtPrice ?? null,
        category: fields.category,
        collections: fields.collections,
        featured: fields.featured,
        condition: fields.condition,
        sizes: fields.sizes,
        stock: fields.stock,
        badge: fields.badge ?? null,
        description: fields.description,
        ...(image && uploadedPath
          ? { image: imageUrl, gallery: [imageUrl], image_path: uploadedPath }
          : {}),
      })
      .eq("id", productId)
      .select(productFields)
      .maybeSingle();
    if (updateError) throw updateError;
    if (!product) {
      if (uploadedPath) await removeImage(uploadedPath);
      return errorResponse("Product not found.", 404);
    }

    if (uploadedPath && currentProduct.image_path) {
      try {
        await removeImage(currentProduct.image_path);
      } catch (cleanupError) {
        console.error("Could not remove the replaced product image.", cleanupError);
      }
    }
    return Response.json({ product: serializeCatalogProduct(product) });
  } catch (error) {
    if (uploadedPath) {
      try {
        await removeImage(uploadedPath);
      } catch (cleanupError) {
        console.error("Could not remove the unreferenced replacement image.", cleanupError);
      }
    }
    console.error("Could not update the product in Supabase.", error);
    return errorResponse(
      getSupabaseConnectionErrorMessage(
        error,
        "The product could not be saved. Check the Supabase connection and try again.",
      ),
      503,
    );
  }
}
