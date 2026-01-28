/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    // Temporarily ignore build errors to see if build completes
    // Remove this after fixing TypeScript errors
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
