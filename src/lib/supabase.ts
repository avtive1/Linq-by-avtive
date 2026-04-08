import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to get a public URL for a file in Supabase Storage.
 * Use only for public buckets — for private buckets call getSignedFileUrl.
 */
export function getFileUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Helper to get a time-limited signed URL for a file in Supabase Storage.
 * Use this for private buckets so attendee photos aren't enumerable.
 */
export async function getSignedFileUrl(
    bucket: string,
    path: string,
    expiresIn = 3600,
): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
    if (error || !data) return null;
    return data.signedUrl;
}

// Helper to check if a user is logged in
export const isUserLoggedIn = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
};
