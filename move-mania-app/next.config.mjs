import WithPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ]
  },
  env: {
    ZION_API_URL: process.env.ZION_API_URL,
    ZION_API_KEY: process.env.ZION_API_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    MODULE_ADDRESS: process.env.MODULE_ADDRESS,
    CRASH_RESOURCE_ACCOUNT_ADDRESS: process.env.CRASH_RESOURCE_ACCOUNT_ADDRESS,
    LP_RESOURCE_ACCOUNT_ADDRESS: process.env.LP_RESOURCE_ACCOUNT_ADDRESS,
    Z_APT_RESOURCE_ACCOUNT_ADDRESS: process.env.Z_APT_RESOURCE_ACCOUNT_ADDRESS,
    ADMIN_ACCOUNT_PRIVATE_KEY: process.env.ADMIN_ACCOUNT_PRIVATE_KEY,
    FUNDING_ACCOUNT_PRIVATE_KEY: process.env.FUNDING_ACCOUNT_PRIVATE_KEY,
    ADMIN_ACCOUNTS: process.env.ADMIN_ACCOUNTS,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

const withPWA = WithPWA({
  dest: "public", // Destination directory for the PWA files
  // disable: process.env.NODE_ENV === "development", // Disable PWA in development mode
  register: true, // Register the PWA service worker
  skipWaiting: true, // Skip waiting for service worker activation
})

export default withPWA(nextConfig);
