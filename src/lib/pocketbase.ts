import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
const IS_NGROK = PB_URL.includes('ngrok-free.app');

export const pb = new PocketBase(PB_URL);

// Bypass the ngrok warning page for free accounts on SDK (API) calls
if (IS_NGROK) {
    pb.beforeSend = function (url, options) {
        options.headers = Object.assign({}, options.headers, {
            'ngrok-skip-browser-warning': 'true',
        });
        return { url, options };
    };
}

/**
 * Build a PocketBase file URL that works both locally AND through ngrok on Vercel.
 *
 * `<img src>` tags cannot send custom headers, and ngrok doesn't accept query 
 * parameter bypasses for browser requests either. To fix this, we created a local 
 * Next.js API route (/api/proxy-image) that fetches the image on the server using 
 * the HTTP header bypass, then streams it back to the client.
 */
export function getFileUrl(
    collection: string,
    recordId: string,
    filename: string
): string {
    const base = `${pb.baseUrl}/api/files/${collection}/${recordId}/${filename}`;
    return IS_NGROK ? `/api/proxy-image?url=${encodeURIComponent(base)}` : base;
}

// Helper to check if a user is logged in
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
};

