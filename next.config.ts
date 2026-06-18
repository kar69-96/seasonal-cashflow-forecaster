import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A parent directory also has a lockfile; pin the workspace root to this project
  // so Turbopack resolves modules and the sim worker from here.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
