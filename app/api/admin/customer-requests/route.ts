import { getAdminSession, isAdminConfigurationReady } from "@/app/lib/admin-auth";
import { serializeCustomerRequest } from "@/app/lib/customer-requests";
import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
} from "@/app/lib/supabase";

export async function GET() {
  if (!isAdminConfigurationReady()) {
    return Response.json({ error: "Supabase Auth and ADMIN_EMAIL must be configured." }, { status: 503 });
  }

  let admin: Awaited<ReturnType<typeof getAdminSession>>;
  try {
    admin = await getAdminSession();
  } catch (error) {
    console.error("Could not verify the admin session for customer requests.", error);
    return Response.json(
      { error: getSupabaseConnectionErrorMessage(error, "The admin session could not be verified.") },
      { status: 503 },
    );
  }
  if (!admin) {
    return Response.json({ error: "Sign in to view customer requests." }, { status: 401 });
  }

  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("customer_requests")
      .select("id,name,category,brand,size,colour,budget,details,status,requested_at,image_path")
      .eq("status", "Pending")
      .order("requested_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return Response.json({
      requests: (data ?? []).map(serializeCustomerRequest),
    });
  } catch (error) {
    console.error("Could not load pending customer requests from Supabase.", error);
    return Response.json(
      {
        error: getSupabaseConnectionErrorMessage(
          error,
          "Pending requests are temporarily unavailable. Check the Supabase connection.",
        ),
      },
      { status: 503 },
    );
  }
}
