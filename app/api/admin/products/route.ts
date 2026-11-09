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

async function getAuthorizedAdmin() {
  if (!isAdminConfigurationReady()) {
    return { admin: null, response: errorResponse("Supabase Auth and ADMIN_EMAIL must be configured.", 503) };
  }
  try {
    const admin = await getAdminSession();
    return admin
      ? { admin, response: null }
      : { admin: null, response: errorResponse("Sign in to manage products.", 401) };
  } catch (error) {
    console.error("Could not verify the admin session for product management.", error);
    return {
      admin: null,
      response: errorResponse(
        getSupabaseConnectionErrorMessage(error, "The admin session could not be verified."),
        503,
      ),
    };
  }
}

export async function GET() {
  const authorization = await getAuthorizedAdmin();
  if (!authorization.admin) return authorization.response;

  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("products")
      .select(productFields)
      .order("id", { ascending: false });
    if (error) throw error;

    return Response.json({
      products: (data ?? []).map(serializeCatalogProduct),
    });
  } catch (error) {
    console.error("Could not load products for admin management from Supabase.", error);
    return errorResponse(
      getSupabaseConnectionErrorMessage(error, "Products could not be loaded."),
      503,
    );
  }
}

export async function POST(request: Request) {
  const authorization = await getAuthorizedAdmin();
  if (!authorization.admin) return authorization.response;

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
    console.error("Could not read the new product details.", error);
    return errorResponse("The product details could not be read.", 400);
  }

  const productInput = parseAdminProductInput(body, true);
  if (!productInput?.image) {
    return errorResponse(
      "Check all product fields, choose at least one collection, and add a valid JPG, PNG, or WebP image up to 5 MB.",
      400,
    );
  }

  let createdId: number | undefined;
  let uploadedPath: string | undefined;
  try {
    const supabase = createSupabaseServiceClient();
    const { image, compareAtPrice, badge, ...fields } = productInput;
    const { data: createdProduct, error: createError } = await supabase
      .from("products")
      .insert({
        ...fields,
        compare_at_price: compareAtPrice ?? null,
        badge: badge ?? null,
        image: "",
        gallery: [],
        image_path: null,
      })
      .select("id")
      .single();

    if (createError) throw createError;
    createdId = createdProduct.id;

    uploadedPath = `products/${createdId}/${randomUUID()}.${getImageExtension(image.contentType)}`;
    await uploadImage(uploadedPath, image.contentType, image.data);
    const imageUrl = `/api/products/${createdId}/image`;
    const { data: product, error: updateError } = await supabase
      .from("products")
      .update({ image: imageUrl, gallery: [imageUrl], image_path: uploadedPath })
      .eq("id", createdId)
      .select(productFields)
      .single();

    if (updateError) throw updateError;
    return Response.json({ product: serializeCatalogProduct(product) }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      try {
        await removeImage(uploadedPath);
      } catch (cleanupError) {
        console.error("Could not remove the unreferenced product image.", cleanupError);
      }
    }
    if (createdId !== undefined) {
      const { error: deleteError } = await createSupabaseServiceClient()
        .from("products")
        .delete()
        .eq("id", createdId);
      if (deleteError) console.error("Could not remove the incomplete product record.", deleteError);
    }
    console.error("Could not add the product to Supabase.", error);
    return errorResponse(
      getSupabaseConnectionErrorMessage(
        error,
        "The product could not be saved. Check the Supabase connection and try again.",
      ),
      503,
    );
  }
}
