import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      'idiom-game-store': './src/lib/game-server-store.ts',
    },
  },
};

export default nextConfig;
