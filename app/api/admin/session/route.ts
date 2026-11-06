import { cookies } from "next/headers";
import {
  adminCookieName,
  adminCookieOptions,
  createAdminSession,
  isAdminConfigurationReady,
  verifyAdminCredentials,
} from "@/app/lib/admin-auth";
import { InvalidJsonBodyError, readJsonBody } from "@/app/lib/request-body";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isAdminConfigurationReady()) {
    return errorResponse(
      "Admin sign-in is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, and a 32-character ADMIN_SESSION_SECRET.",
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

  const configuration = verifyAdminCredentials(body.email, body.password);
  if (!configuration) {
    return errorResponse("The email or password is incorrect.", 401);
  }

  (await cookies()).set(
    adminCookieName,
    createAdminSession(configuration),
    adminCookieOptions(),
  );

  return Response.json({ admin: { email: configuration.email } });
}

export async function DELETE() {
  (await cookies()).set(adminCookieName, "", {
    ...adminCookieOptions(),
    maxAge: 0,
  });
  return Response.json({ signedOut: true });
}
