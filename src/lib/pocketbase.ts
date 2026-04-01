import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://be0d-103-149-240-98.ngrok-free.app';
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
 * Build a PocketBase file URL that works through ngrok.
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

