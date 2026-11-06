import { ObjectId } from "mongodb";
import { connection } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import {
  type CustomerRequestDocument,
  serializeCustomerRequest,
} from "@/app/lib/customer-requests";
import {
  getDatabase,
  getMongoConnectionErrorMessage,
} from "@/app/lib/mongodb";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession();
  if (!admin) {
    return Response.json({ error: "Sign in to approve customer requests." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return Response.json({ error: "Request not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The approval request must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("action" in body) ||
    body.action !== "approve"
  ) {
    return Response.json({ error: "Choose a valid request action." }, { status: 400 });
  }

  await connection();

  try {
    const database = await getDatabase();
    const collection = database.collection<CustomerRequestDocument>("customerRequests");
    const result = await collection.updateOne(
      { _id: new ObjectId(id), status: "Pending" },
      {
        $set: {
          status: "Approved",
          approvedAt: new Date(),
          approvedBy: admin.email,
        },
      },
    );

    if (result.matchedCount === 0) {
      return Response.json(
        { error: "This request was already reviewed or no longer exists." },
        { status: 409 },
      );
    }

    const approvedRequest = await collection.findOne({ _id: new ObjectId(id) });
    if (!approvedRequest) {
      return Response.json({ error: "The approved request could not be reloaded." }, { status: 500 });
    }

    return Response.json({ request: serializeCustomerRequest(approvedRequest) });
  } catch (error) {
    console.error("Could not approve the customer request in MongoDB.", error);
    return Response.json(
      {
        error: getMongoConnectionErrorMessage(
          error,
          "The request could not be approved. Check the MongoDB connection.",
        ),
      },
      { status: 503 },
    );
  }
}
