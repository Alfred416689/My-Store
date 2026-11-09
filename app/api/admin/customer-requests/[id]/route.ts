import { getAdminSession, isAdminConfigurationReady } from "@/app/lib/admin-auth";
import { serializeCustomerRequest } from "@/app/lib/customer-requests";
import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
} from "@/app/lib/supabase";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminConfigurationReady()) {
    return Response.json({ error: "Supabase Auth and ADMIN_EMAIL must be configured." }, { status: 503 });
  }

  let admin: Awaited<ReturnType<typeof getAdminSession>>;
  try {
    admin = await getAdminSession();
  } catch (error) {
    console.error("Could not verify the admin session for request approval.", error);
    return Response.json(
      { error: getSupabaseConnectionErrorMessage(error, "The admin session could not be verified.") },
      { status: 503 },
    );
  }
  if (!admin) {
    return Response.json({ error: "Sign in to approve customer requests." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
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

  try {
    const supabase = createSupabaseServiceClient();
    const { data: updatedRequest, error } = await supabase
      .from("customer_requests")
      .update({
        status: "Approved",
        approved_at: new Date().toISOString(),
        approved_by: admin.email,
      })
      .eq("id", id)
      .eq("status", "Pending")
      .select("id,name,category,brand,size,colour,budget,details,status,requested_at,image_path")
      .maybeSingle();

    if (error) throw error;
    if (!updatedRequest) {
      return Response.json(
        { error: "This request was already reviewed or no longer exists." },
        { status: 409 },
      );
    }

    return Response.json({
      request: serializeCustomerRequest(updatedRequest),
    });
  } catch (error) {
    console.error("Could not approve the customer request in Supabase.", error);
    return Response.json(
      {
        error: getSupabaseConnectionErrorMessage(
          error,
          "The request could not be approved. Check the Supabase connection.",
        ),
      },
      { status: 503 },
    );
  }
}
