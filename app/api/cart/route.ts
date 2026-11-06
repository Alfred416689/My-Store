import { createHash, randomBytes } from "node:crypto";
import type { Collection, Db, Document } from "mongodb";
import { connection } from "next/server";
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

const cookieName = "s2g_cart";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const maxBodyBytes = 32 * 1024;

type StoredCartItem = {
  productId: number;
  size: string;
  quantity: number;
};

type CartDocument = Document & {
  sessionId: string;
  items: StoredCartItem[];
  updatedAt: Date;
};

type ProductDocument = Document & {
  id: number;
  name: string;
  price: number;
  image: string;
  sizes: string[];
  stock: number;
};

type CartItem = StoredCartItem & {
  name: string;
  price: number;
  image: string;
};

type CartCollections = {
  carts: Collection<CartDocument>;
  products: Awaited<ReturnType<typeof ensureProductCatalog>>;
};

const collectionsByDatabase = new WeakMap<Db, Promise<CartCollections>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSessionToken(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  return cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : null;
}

function getOrCreateSessionToken(request: Request) {
  const existingToken = getSessionToken(request);
  return {
    token: existingToken ?? randomBytes(32).toString("hex"),
    isNew: existingToken === null,
  };
}

function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function sessionKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function jsonResponse(
  body: unknown,
  status = 200,
  token?: string,
) {
  const response = Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
  if (token) response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}

function parseCartItems(value: unknown): StoredCartItem[] | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 30) {
    return null;
  }

  const items: StoredCartItem[] = [];
  const uniqueItems = new Set<string>();

  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.productId !== "number" ||
      !Number.isInteger(item.productId) ||
      typeof item.size !== "string" ||
      item.size.length > 30 ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return null;
    }

    const key = `${item.productId}:${item.size}`;
    if (uniqueItems.has(key)) return null;
    uniqueItems.add(key);
    items.push({
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
    });
  }

  return items;
}

async function hydrateCart(
  items: StoredCartItem[],
  products: Awaited<ReturnType<typeof ensureProductCatalog>>,
): Promise<CartItem[] | null> {
  if (items.length === 0) return [];

  const productDocuments = await products
    .find<ProductDocument>(
      { id: { $in: items.map((item) => item.productId) } },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          price: 1,
          image: 1,
          sizes: 1,
          stock: 1,
        },
      },
    )
    .toArray();
  const productById = new Map(productDocuments.map((product) => [product.id, product]));
  const quantityByProduct = new Map<number, number>();
  const hydratedItems: CartItem[] = [];

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || !product.sizes.includes(item.size)) return null;

    const nextQuantity = (quantityByProduct.get(product.id) ?? 0) + item.quantity;
    if (nextQuantity > product.stock) return null;
    quantityByProduct.set(product.id, nextQuantity);

    hydratedItems.push({
      ...item,
      name: product.name,
      price: product.price,
      image: product.image,
    });
  }

  return hydratedItems;
}

async function getCollections() {
  const database = await getDatabase();
  let collections = collectionsByDatabase.get(database);
  if (!collections) {
    collections = (async () => {
      const carts = database.collection<CartDocument>("shoppingCarts");
      await Promise.all([
        carts.createIndex({ sessionId: 1 }, { unique: true }),
        carts.createIndex(
          { updatedAt: 1 },
          { expireAfterSeconds: sessionMaxAgeSeconds },
        ),
      ]);
      const products = await ensureProductCatalog(database);
      return { carts, products };
    })();
    collectionsByDatabase.set(database, collections);
    void collections.catch(() => collectionsByDatabase.delete(database));
  }
  return collections;
}

export async function GET(request: Request) {
  await connection();
  const { token, isNew } = getOrCreateSessionToken(request);

  try {
    const { carts, products } = await getCollections();
    const cart = await carts.findOne({ sessionId: sessionKey(token) });
    const items = await hydrateCart(cart?.items ?? [], products);
    if (!items) {
      return jsonResponse(
        { error: "A saved item is no longer available. Please rebuild your bag." },
        409,
        isNew ? token : undefined,
      );
    }
    return jsonResponse({ items }, 200, isNew ? token : undefined);
  } catch (error) {
    console.error("Could not load the shopping bag from MongoDB.", error);
    return jsonResponse(
      {
        error: getMongoConnectionErrorMessage(
          error,
          "The shopping bag could not be loaded. Check the MongoDB connection.",
        ),
      },
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "Send the shopping bag as JSON." }, 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, maxBodyBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse({ error: "The shopping bag is too large." }, 413);
    }
    if (error instanceof InvalidJsonBodyError) {
      return jsonResponse({ error: "The request body must be valid JSON." }, 400);
    }
    console.error("Could not read the shopping bag request.", error);
    return jsonResponse({ error: "The request could not be read." }, 400);
  }

  const items = parseCartItems(body);
  if (!items) {
    return jsonResponse({ error: "The shopping bag contains invalid items." }, 400);
  }

  const { token, isNew } = getOrCreateSessionToken(request);
  try {
    const { carts, products } = await getCollections();
    const hydratedItems = await hydrateCart(items, products);
    if (!hydratedItems) {
      return jsonResponse(
        { error: "A selected size or quantity is no longer available." },
        409,
        isNew ? token : undefined,
      );
    }

    await carts.updateOne(
      { sessionId: sessionKey(token) },
      {
        $set: {
          items: items.map(({ productId, size, quantity }) => ({
            productId,
            size,
            quantity,
          })),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return jsonResponse({ items: hydratedItems }, 200, isNew ? token : undefined);
  } catch (error) {
    console.error("Could not save the shopping bag to MongoDB.", error);
    return jsonResponse(
      {
        error: getMongoConnectionErrorMessage(
          error,
          "The shopping bag could not be saved. Check the MongoDB connection.",
        ),
      },
      503,
    );
  }
}
