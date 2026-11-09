import {
  createSupabaseServiceClient,
  supabaseStorageBucket,
} from "@/app/lib/supabase";

export function getImageExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      throw new Error("Unsupported image content type.");
  }
}

export async function uploadImage(path: string, contentType: string, data: Buffer) {
  const { error } = await createSupabaseServiceClient()
    .storage
    .from(supabaseStorageBucket)
    .upload(path, data, { contentType, upsert: false });
  if (error) throw error;
}

export async function removeImage(path: string) {
  const { error } = await createSupabaseServiceClient()
    .storage
    .from(supabaseStorageBucket)
    .remove([path]);
  if (error) throw error;
}

export async function downloadImage(path: string) {
  const { data, error } = await createSupabaseServiceClient()
    .storage
    .from(supabaseStorageBucket)
    .download(path);
  if (error) throw error;
  return data;
}
