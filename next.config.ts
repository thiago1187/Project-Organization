import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Silencia a detecção errada de workspace root: há um package-lock.json
  // solto em ~/ (fora deste repositório) que o Next confunde com raiz.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
