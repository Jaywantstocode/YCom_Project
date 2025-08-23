import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix turbopack root directory issue
  turbopack: {
    root: __dirname,
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
