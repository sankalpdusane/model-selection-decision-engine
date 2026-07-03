import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config silences the "webpack config present but no turbopack config"
  // warning in Next 16 dev mode. better-sqlite3 is only imported in server routes so
  // Turbopack never tries to bundle it for the browser.
  turbopack: {},
  // Exclude native better-sqlite3 addon from the production webpack bundle.
  webpack: (config) => {
    config.externals.push('better-sqlite3')
    return config
  },
};

export default nextConfig;
