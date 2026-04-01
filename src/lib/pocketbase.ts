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
 * `<img src>` tags cannot send custom headers, so the ngrok browser-warning
 * interstitial blocks images on Vercel. Appending the bypass as a query param
 * is the only reliable way to skip it for direct browser requests.
 */
export function getFileUrl(
    collection: string,
    recordId: string,
    filename: string
): string {
    const base = `${pb.baseUrl}/api/files/${collection}/${recordId}/${filename}`;
    return IS_NGROK ? `${base}?ngrok-skip-browser-warning=true` : base;
}

// Helper to check if a user is logged in
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
};

