import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Helper to upload files directly to Supabase Storage
 * This is used for Vercel deployment where local filesystem is read-only.
 */
export async function uploadToSupabaseBucket(
    bucketName: string,
    filePath: string,
    fileBody: Buffer | ArrayBuffer | Blob,
    contentType: string
) {
    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBody, {
            contentType,
            upsert: true
        });

    if (error) {
        console.error(`Error uploading to Supabase bucket ${bucketName}:`, error);
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

    return publicUrl;
}
