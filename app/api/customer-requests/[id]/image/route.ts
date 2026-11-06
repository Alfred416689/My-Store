import { Binary, ObjectId } from "mongodb";
import { connection } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import {
  getDatabase,
  getMongoConnectionErrorMessage,
} from "@/app/lib/mongodb";

type CustomerRequestImage = {
  status: "Pending" | "Approved";
  image: { contentType: string; data: Binary } | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return new Response("Not found", { status: 404 });
  }

  const isAdmin = Boolean(await getAdminSession());
  await connection();

  try {
    const request = await (await getDatabase())
      .collection<CustomerRequestImage>("customerRequests")
      .findOne(
        {
          _id: new ObjectId(id),
          ...(isAdmin ? {} : { status: "Approved" }),
        },
        { projection: { image: 1, status: 1 } },
      );

    if (!request?.image) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(Buffer.from(request.image.data.value()), {
      headers: {
        "Content-Type": request.image.contentType,
        "Cache-Control": isAdmin ? "private, no-store" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Could not load the customer request image from MongoDB.", error);
    return new Response(
      getMongoConnectionErrorMessage(error, "Image unavailable"),
      { status: 503 },
    );
  }
}
