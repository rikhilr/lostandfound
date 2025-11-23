import { supabaseAdmin } from "./server";


export async function uploadImageToBucket(file: File) {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `found-items/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from("found-items")
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabaseAdmin.storage
    .from("found-items")
    .getPublicUrl(filePath);

  return {
    filePath,
    publicUrl: data.publicUrl,
  };
}