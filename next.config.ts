import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Üst klasörde (ör. C:\Users\ismail\) başka package-lock.json varken Turbopack kökünü netleştirir
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
