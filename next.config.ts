import type { NextConfig } from "next";
const config: NextConfig = { serverExternalPackages: ["pg", "graphile-worker"] };
export default config;
