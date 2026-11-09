import { connection } from "next/server";
import { getAdminSession } from "@/app/lib/admin-auth";
import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
  supabaseStorageBucket,
} from "@/app/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const admin = await getAdminSession();
    await connection();

    const supabase = createSupabaseServiceClient();
    let requestQuery = supabase
      .from("customer_requests")
      .select("status,image_path")
      .eq("id", id);
    if (!admin) requestQuery = requestQuery.eq("status", "Approved");
    const { data: customerRequest, error: requestError } = await requestQuery.maybeSingle();

    if (requestError) throw requestError;
    if (!customerRequest?.image_path) return new Response("Not found", { status: 404 });

    const { data: image, error: imageError } = await supabase.storage
      .from(supabaseStorageBucket)
      .download(customerRequest.image_path);
    if (imageError) throw imageError;

    return new Response(image, {
      headers: {
        "Content-Type": image.type || "application/octet-stream",
        "Cache-Control": admin ? "private, no-store" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Could not load a customer request image from Supabase.", error);
    return new Response(
      getSupabaseConnectionErrorMessage(error, "Image unavailable"),
      { status: 503 },
    );
  }
}
