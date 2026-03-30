import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Bypass the ngrok warning page for free accounts
if (typeof window !== 'undefined' && PB_URL.includes('ngrok-free.app')) {
    pb.beforeSend = function (url, options) {
        options.headers = Object.assign({}, options.headers, {
            'ngrok-skip-browser-warning': 'true',
        });
        return { url, options };
    };
}

// Helper to check if a user is logged in
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
};

