import { supabase } from "@/integrations/supabase/client";

export interface ImageUploadResult {
  url: string;
  path: string;
}

export interface ImageValidationError {
  message: string;
}

// Image validation constants
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_IMAGES_PER_RECIPE = 5;

/**
 * Validates an image file
 */
export function validateImage(file: File): ImageValidationError | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["jpeg", "jpg", "png", "webp"];
  const typeOk = ALLOWED_TYPES.includes(file.type) || (!file.type && !!extension && allowedExtensions.includes(extension));
  if (!typeOk) {
    return {
      message: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      message: `File size too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return null;
}

/**
 * Generates a unique filename for uploaded images
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  return `${timestamp}_${random}.${extension}`;
}

/**
 * Uploads an image to Supabase Storage
 */
export async function uploadImage(
  file: File, 
  recipeId: string
): Promise<ImageUploadResult> {
  // Validate the image
  const validationError = validateImage(file);
  if (validationError) {
    throw new Error(validationError.message);
  }

  // Generate unique filename
  const filename = generateUniqueFilename(file.name);
  const filePath = `${recipeId}/${filename}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('recipe-screenshots')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('recipe-screenshots')
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath
  };
}

/**
 * Deletes an image from Supabase Storage
 */
export async function deleteImage(imagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('recipe-screenshots')
    .remove([imagePath]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Saves image metadata to the database
 */
export async function saveImageMetadata(
  recipeId: string,
  imageUrl: string,
  displayOrder: number
): Promise<string> {
  const { data, error } = await supabase
    .from('recipe_screenshots')
    .insert({
      recipe_id: recipeId,
      image_url: imageUrl,
      display_order: displayOrder
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save image metadata: ${error.message}`);
  }

  return data.id;
}

/**
 * Deletes image metadata from the database
 */
export async function deleteImageMetadata(imageId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_screenshots')
    .delete()
    .eq('id', imageId);

  if (error) {
    throw new Error(`Failed to delete image metadata: ${error.message}`);
  }
}

/**
 * Gets all screenshots for a recipe
 */
export async function getRecipeScreenshots(recipeId: string) {
  const { data, error } = await supabase
    .from('recipe_screenshots')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch screenshots: ${error.message}`);
  }

  return data || [];
}

/**
 * Updates the display order of screenshots
 */
export async function updateScreenshotOrder(
  screenshotId: string,
  newOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('recipe_screenshots')
    .update({ display_order: newOrder })
    .eq('id', screenshotId);

  if (error) {
    throw new Error(`Failed to update screenshot order: ${error.message}`);
  }
}

/**
 * Complete image upload process: upload file + save metadata
 */
export async function uploadRecipeImage(
  file: File,
  recipeId: string,
  displayOrder: number
): Promise<{ id: string; url: string }> {
  // Upload the file
  const uploadResult = await uploadImage(file, recipeId);
  
  // Save metadata
  const imageId = await saveImageMetadata(recipeId, uploadResult.url, displayOrder);
  
  return {
    id: imageId,
    url: uploadResult.url
  };
}

/**
 * Extracts the storage object path from a public recipe-screenshots URL.
 */
export function getStoragePathFromPublicUrl(imageUrl: string): string {
  const marker = "/recipe-screenshots/";
  const index = imageUrl.indexOf(marker);
  if (index === -1) {
    throw new Error("Invalid screenshot URL: cannot determine storage path");
  }
  return decodeURIComponent(imageUrl.slice(index + marker.length));
}

/**
 * Complete image deletion process: delete file + metadata
 */
export async function deleteRecipeImage(imageId: string, imagePath: string): Promise<void> {
  // Delete from storage
  await deleteImage(imagePath);
  
  // Delete metadata
  await deleteImageMetadata(imageId);
}
