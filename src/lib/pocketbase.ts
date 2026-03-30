import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Helper to check if a user is logged in
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
};

