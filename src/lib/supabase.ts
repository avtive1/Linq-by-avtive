import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to get a public URL for a file in Supabase Storage.
 */
export function getFileUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

// Helper to check if a user is logged in
export const isUserLoggedIn = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
};
