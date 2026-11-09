import { getAdminSession, isAdminConfigurationReady } from "@/app/lib/admin-auth";
import {
  createSupabaseServerClient,
  getSupabaseConnectionErrorMessage,
} from "@/app/lib/supabase";
import { InvalidJsonBodyError, readJsonBody } from "@/app/lib/request-body";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  try {
    if (!isAdminConfigurationReady()) {
      return errorResponse("Supabase Auth and ADMIN_EMAIL must be configured.", 503);
    }

    const admin = await getAdminSession();
    return admin
      ? Response.json({ admin })
      : errorResponse("Sign in to manage the store.", 401);
  } catch (error) {
    console.error("Could not verify the Supabase admin session.", error);
    return errorResponse(
      getSupabaseConnectionErrorMessage(error, "The admin session could not be verified."),
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!isAdminConfigurationReady()) {
    return errorResponse(
      "Supabase Auth, its server-side key, and ADMIN_EMAIL must be configured.",
      503,
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("Send the sign-in details as JSON.", 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 4096);
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return errorResponse("The sign-in request must be valid JSON.", 400);
    }
    return errorResponse("The sign-in request could not be read.", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return errorResponse("Enter a valid email address and password.", 400);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });

    if (error) return errorResponse("The email or password is incorrect.", 401);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!data.user.email || data.user.email.toLowerCase() !== adminEmail) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      return errorResponse("This Supabase account is not authorized to manage the store.", 403);
    }

    return Response.json({ admin: { email: data.user.email } });
  } catch (error) {
    console.error("Could not sign in through Supabase Auth.", error);
    return errorResponse(
      getSupabaseConnectionErrorMessage(error, "Admin sign-in is temporarily unavailable."),
      503,
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    return Response.json({ signedOut: true });
  } catch (error) {
    console.error("Could not sign out from Supabase Auth.", error);
    return errorResponse(
      getSupabaseConnectionErrorMessage(error, "Could not sign out. Please try again."),
      503,
    );
  }
}
