import { createHash, randomBytes } from "node:crypto";
import { connection } from "next/server";
import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
} from "@/app/lib/supabase";
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

type ProductDocument = {
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

function jsonResponse(body: unknown, status = 200, token?: string) {
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
  products: ProductDocument[],
): Promise<CartItem[] | null> {
  if (items.length === 0) return [];

  const productById = new Map(products.map((product) => [product.id, product]));
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

async function getProducts(items: StoredCartItem[]) {
  if (items.length === 0) return [];

  const { data, error } = await createSupabaseServiceClient()
    .from("products")
    .select("id,name,price,image,sizes,stock")
    .in("id", [...new Set(items.map((item) => item.productId))]);
  if (error) throw error;
  return data ?? [];
}

export async function GET(request: Request) {
  await connection();
  const { token, isNew } = getOrCreateSessionToken(request);

  try {
    const supabase = createSupabaseServiceClient();
    const { error: pruneError } = await supabase.rpc("prune_expired_shopping_carts");
    if (pruneError) throw pruneError;

    const now = new Date().toISOString();
    const { data: cart, error } = await supabase
      .from("shopping_carts")
      .select("items")
      .eq("session_id", sessionKey(token))
      .gt("expires_at", now)
      .maybeSingle();
    if (error) throw error;

    const items = cart ? parseCartItems({ items: cart.items }) : [];
    if (!items) {
      return jsonResponse(
        { error: "A saved item is no longer available. Please rebuild your bag." },
        409,
        isNew ? token : undefined,
      );
    }

    const hydratedItems = await hydrateCart(items, await getProducts(items));
    if (!hydratedItems) {
      return jsonResponse(
        { error: "A saved item is no longer available. Please rebuild your bag." },
        409,
        isNew ? token : undefined,
      );
    }
    return jsonResponse({ items: hydratedItems }, 200, isNew ? token : undefined);
  } catch (error) {
    console.error("Could not load the shopping bag from Supabase.", error);
    return jsonResponse(
      {
        error: getSupabaseConnectionErrorMessage(
          error,
          "The shopping bag could not be loaded. Check the Supabase connection.",
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
    const supabase = createSupabaseServiceClient();
    const { error: pruneError } = await supabase.rpc("prune_expired_shopping_carts");
    if (pruneError) throw pruneError;

    const hydratedItems = await hydrateCart(items, await getProducts(items));
    if (!hydratedItems) {
      return jsonResponse(
        { error: "A selected size or quantity is no longer available." },
        409,
        isNew ? token : undefined,
      );
    }

    const now = new Date();
    const { error } = await supabase
      .from("shopping_carts")
      .upsert(
        {
          session_id: sessionKey(token),
          items,
          updated_at: now.toISOString(),
          expires_at: new Date(now.getTime() + sessionMaxAgeSeconds * 1000).toISOString(),
        },
        { onConflict: "session_id" },
      );
    if (error) throw error;

    return jsonResponse({ items: hydratedItems }, 200, isNew ? token : undefined);
  } catch (error) {
    console.error("Could not save the shopping bag to Supabase.", error);
    return jsonResponse(
      {
        error: getSupabaseConnectionErrorMessage(
          error,
          "The shopping bag could not be saved. Check the Supabase connection.",
        ),
      },
      503,
    );
  }
}
