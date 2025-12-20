import { supabase } from './supabaseClient';

/**
 * Map logical bucket names to your actual Supabase bucket names.
 * You named them: "uploads-public" and "uploads-private".
 * You can still pass explicit bucket names; this just normalizes common values.
 */
export function resolveBucketName(bucketLike) {
  if (!bucketLike) return 'uploads-public';
  if (bucketLike === 'public') return 'uploads-public';
  if (bucketLike === 'private') return 'uploads-private';
  return bucketLike; // treat as explicit bucket name
}

/**
 * Upload a File/Blob to Supabase Storage
 * Ensures the first path segment is the current user's UID to satisfy RLS.
 * @param {File|Blob} file
 * @param {Object} opts
 *  - bucket: 'uploads-public' | 'uploads-private' | 'public' | 'private' | custom
 *  - pathPrefix: e.g. `images/${slug}/${entryId}` (will be nested under `${uid}/...`)
 *  - makePublic: boolean (if bucket is public and you want a public URL back)
 */
export async function uploadToSupabase(file, { bucket, pathPrefix = '', makePublic = false } = {}) {
  const bucketName = resolveBucketName(bucket);

  // Get the current Supabase session and UID
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) throw new Error('Not signed into Supabase Auth');

  const ext = (file?.name || '').split('.').pop()?.toLowerCase() || 'bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Prepend UID as the first path segment to satisfy your storage RLS policies
  const userScopedPrefix = pathPrefix ? `${uid}/${pathPrefix}` : `${uid}`;
  const path = `${userScopedPrefix}/${filename}`;

  const { error } = await supabase.storage.from(bucketName).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: file.type || undefined,
  });
  if (error) throw error;

  let publicUrl = null;
  if (makePublic) {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    publicUrl = data?.publicUrl || null;
  }

  return { bucket: bucketName, path, publicUrl };
}

/**
 * Get a signed URL for private files (or public if you prefer signed access).
 * @param {string} bucket
 * @param {string} path
 * @param {number} expiresIn seconds
 * @returns {Promise<string>}
 */
export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  const bucketName = resolveBucketName(bucket);
  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl;
}
