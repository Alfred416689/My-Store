import { createSupabaseServerClient, isSupabaseConfigured } from "@/app/lib/supabase";

export function isAdminConfigurationReady() {
  return isSupabaseConfigured() && Boolean(process.env.ADMIN_EMAIL);
}

export async function getAdminSession() {
  if (!isAdminConfigurationReady()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw error;
  }

  const email = data.user?.email;
  return email?.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase()
    ? { email }
    : null;
}
