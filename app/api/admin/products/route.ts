import { connection } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import { parseAdminProductInput } from "@/app/lib/admin-product-input";
import {
  ensureProductCatalog,
  type CatalogProductDocument,
} from "@/app/lib/catalog";
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

export async function GET() {
  if (!(await getAdminSession())) {
    return errorResponse("Sign in to manage products.", 401);
  }

  await connection();
  try {
    const products = await ensureProductCatalog(await getDatabase());
    const inventory = await products
      .find(
        {},
        {
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
            gallery: 1,
            badge: 1,
            stock: 1,
            description: 1,
          },
        },
      )
      .sort({ id: -1 })
      .toArray();
    return Response.json({ products: inventory });
  } catch (error) {
    console.error("Could not load products for admin management.", error);
    return errorResponse(
      getMongoConnectionErrorMessage(error, "Products could not be loaded."),
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return errorResponse("Sign in to add products.", 401);
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
    console.error("Could not read the new product details.", error);
    return errorResponse("The product details could not be read.", 400);
  }

  const productInput = parseAdminProductInput(body, true);
  if (!productInput || !productInput.image) {
    return errorResponse(
      "Check all product fields, choose at least one collection, and add a valid JPG, PNG, or WebP image up to 5 MB.",
      400,
    );
  }

  await connection();

  try {
    const database = await getDatabase();
    const products = await ensureProductCatalog(database);
    const latestProduct = await products
      .find({}, { projection: { id: 1 } })
      .sort({ id: -1 })
      .limit(1)
      .next();
    const counters = database.collection<{ _id: string; value: number }>("counters");

    await counters.updateOne(
      { _id: "products" },
      { $max: { value: latestProduct?.id ?? 0 } },
      { upsert: true },
    );
    const counter = await counters.findOneAndUpdate(
      { _id: "products" },
      { $inc: { value: 1 } },
      { returnDocument: "after" },
    );
    if (!counter || !Number.isSafeInteger(counter.value)) {
      throw new Error("Could not allocate a product ID.");
    }

    const id = counter.value;
    const imageUrl = `/api/products/${id}/image`;
    const { image: productImage, ...productFields } = productInput;
    const product: CatalogProductDocument = {
      id,
      ...productFields,
      image: imageUrl,
      gallery: [imageUrl],
      imageData: productImage,
    };

    await products.insertOne(product);
    return Response.json(
      {
        product: {
          id,
          ...productFields,
          image: imageUrl,
          gallery: [imageUrl],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Could not add the product to MongoDB.", error);
    return errorResponse(
      getMongoConnectionErrorMessage(
        error,
        "The product could not be saved. Check the MongoDB connection and try again.",
      ),
      503,
    );
  }
}
