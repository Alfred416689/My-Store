import {
  createSupabaseServiceClient,
  getSupabaseConnectionErrorMessage,
} from "@/app/lib/supabase";
import {
  InvalidJsonBodyError,
  PayloadTooLargeError,
  readJsonBody,
} from "@/app/lib/request-body";

const maxRequestBytes = 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Send the email as JSON." }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, maxRequestBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ error: "The request body is too large." }, { status: 413 });
    }
    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
    }
    console.error("Could not read the newsletter request body.", error);
    return Response.json({ error: "The request could not be read." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.email !== "string") {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = body.email.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    const { error } = await createSupabaseServiceClient()
      .from("newsletter_subscribers")
      .upsert(
        { email, email_normalized: normalizedEmail },
        { onConflict: "email_normalized", ignoreDuplicates: true },
      );

    if (error) throw error;
    return Response.json({ message: "Thanks for joining the S2G list." });
  } catch (error) {
    console.error("Could not save the newsletter subscription to Supabase.", error);
    return Response.json(
      {
        error: getSupabaseConnectionErrorMessage(
          error,
          "We could not save your email. Check the Supabase connection and try again.",
        ),
      },
      { status: 503 },
    );
  }
}
