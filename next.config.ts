import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["mixing-argued-encyclopedia-audit.trycloudflare.com"],
  serverExternalPackages: ["argon2"],
  transpilePackages: ["framer-motion"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
