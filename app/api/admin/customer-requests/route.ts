import { connection } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import {
  getCustomerRequestCollection,
  serializeCustomerRequest,
} from "@/app/lib/customer-requests";
import {
  getDatabase,
  getMongoConnectionErrorMessage,
} from "@/app/lib/mongodb";

export async function GET() {
  if (!(await getAdminSession())) {
    return Response.json({ error: "Sign in to view customer requests." }, { status: 401 });
  }

  await connection();

  try {
    const requestCollection = await getCustomerRequestCollection(await getDatabase());
    const requests = await requestCollection
      .find({ status: "Pending" }, { projection: { image: 0 } })
      .sort({ requestedAt: -1 })
      .limit(200)
      .toArray();

    return Response.json({ requests: requests.map(serializeCustomerRequest) });
  } catch (error) {
    console.error("Could not load pending customer requests from MongoDB.", error);
    return Response.json(
      {
        error: getMongoConnectionErrorMessage(
          error,
          "Pending requests are temporarily unavailable. Check the MongoDB connection.",
        ),
      },
      { status: 503 },
    );
  }
}
