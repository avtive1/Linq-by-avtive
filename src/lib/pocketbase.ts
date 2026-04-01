import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://be0d-103-149-240-98.ngrok-free.app';

export const pb = new PocketBase(PB_URL);

/**
 * Build a PocketBase file URL.
 * PocketBase storage handles serving files automatically.
 */
export function getFileUrl(
    collection: string,
    recordId: string,
    filename: string
): string {
    return `${pb.baseUrl}/api/files/${collection}/${recordId}/${filename}`;
}

// Helper to check if a user is logged in
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
};

