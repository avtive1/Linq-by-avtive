import { neonAuth } from "@/auth";

export const { GET, POST, PUT, DELETE, PATCH } = neonAuth.handler();
