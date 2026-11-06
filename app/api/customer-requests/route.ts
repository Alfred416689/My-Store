import { Binary } from "mongodb";
import { connection } from "next/server";
import {
  type CustomerRequestDocument,
  getCustomerRequestCollection,
  serializeCustomerRequest,
} from "@/app/lib/customer-requests";
import {
  getDatabase,
  getMongoConnectionErrorMessage,
} from "@/app/lib/mongodb";
import {
  InvalidJsonBodyError,
  PayloadTooLargeError,
  readJsonBody,
} from "@/app/lib/request-body";

const categories = new Set([
  "T-shirts",
  "Shirts",
  "Jeans",
  "Trousers",
  "Jackets",
  "Hoodies",
  "Dresses",
  "Footwear",
  "Accessories",
  "Other",
]);
const maxImageBytes = 5 * 1024 * 1024;
const maxImageBase64Length = 4 * Math.ceil(maxImageBytes / 3);
const maxRequestBytes = 7 * 1024 * 1024;

type RequestInput = {
  name: string;
  category: string;
  brand: string;
  size: string;
  colour: string;
  budget: number;
  details: string;
  image: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length > maxLength || (required && text.length === 0)) return null;
  return text;
}

function parseRequestInput(value: unknown): RequestInput | null {
  if (!isRecord(value) || value.publicConsent !== true) return null;

  const name = readText(value.name, 100, true);
  const category = readText(value.category, 30, true);
  const brand = readText(value.brand, 60);
  const size = readText(value.size, 30);
  const colour = readText(value.colour, 40);
  const details = readText(value.details, 500);
  const image = readText(value.image, maxImageBase64Length + 128);
  const budget = value.budget;

  if (
    name === null ||
    category === null ||
    !categories.has(category) ||
    brand === null ||
    size === null ||
    colour === null ||
    details === null ||
    image === null ||
    typeof budget !== "number" ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > 1_000_000
  ) {
    return null;
  }

  return { name, category, brand, size, colour, budget, details, image };
}

function parseImage(value: string) {
  if (!value) return null;

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > maxImageBase64Length) {
    return undefined;
  }

  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > maxImageBytes) {
    return undefined;
  }

  return { contentType: match[1], data: new Binary(data) };
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  await connection();
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return errorResponse("Choose a valid customer request limit.", 400);
  }

  try {
    const requestCollection = await getCustomerRequestCollection(await getDatabase());
    const requests = await requestCollection
      .find({ status: "Approved" }, { projection: { image: 0 } })
      .sort({ requestedAt: -1 })
      .limit(limit)
      .toArray();

    return Response.json(
      { requests: requests.map(serializeCustomerRequest) },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Could not load customer requests from MongoDB.", error);
    return errorResponse(
      getMongoConnectionErrorMessage(
        error,
        "Customer requests are temporarily unavailable. Check the MongoDB connection.",
      ),
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("Send the request as JSON.", 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, maxRequestBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return errorResponse("The request is too large. Reference images must be 5 MB or smaller.", 413);
    }
    if (error instanceof InvalidJsonBodyError) {
      return errorResponse("The request body must be valid JSON.", 400);
    }
    console.error("Could not read the customer request body.", error);
    return errorResponse("The request could not be read.", 400);
  }

  const input = parseRequestInput(body);
  if (!input) {
    return errorResponse("Check the request fields and confirm that the request will be public.", 400);
  }

  const image = parseImage(input.image);
  if (image === undefined) {
    return errorResponse("Choose a valid JPG, PNG, or WebP reference image up to 5 MB.", 400);
  }

  const document = {
    name: input.name,
    category: input.category,
    brand: input.brand,
    size: input.size,
    colour: input.colour,
    budget: input.budget,
    details: input.details,
    status: "Pending" as const,
    requestedAt: new Date(),
    hasImage: image !== null,
    image,
  };

  try {
    const result = await (await getDatabase())
      .collection<CustomerRequestDocument>("customerRequests")
      .insertOne(document);
    const savedRequest = { ...document, _id: result.insertedId };
    return Response.json({ request: serializeCustomerRequest(savedRequest) }, { status: 201 });
  } catch (error) {
    console.error("Could not save the customer request to MongoDB.", error);
    return errorResponse(
      getMongoConnectionErrorMessage(
        error,
        "Your request could not be saved. Check the MongoDB connection and try again.",
      ),
      503,
    );
  }
}
