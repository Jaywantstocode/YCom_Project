import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix turbopack root directory issue
  turbopack: {
    root: __dirname,
  },
  // Configure image domains for Next.js Image component
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ooeziwqlhmevflojdfhu.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Ignore problematic directories
  webpack: (config, { isServer }) => {
    // Ignore system directories that might cause issues
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/Trash/**',
        '**/.Trash/**',
      ],
    };
    return config;
  },
};

export default nextConfig;
