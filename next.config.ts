import type { NextConfig } from "next";
const config: NextConfig = { async headers(){return [{source:"/:path*",headers:[{key:"Referrer-Policy",value:"same-origin"},{key:"X-Content-Type-Options",value:"nosniff"}]}];}, serverExternalPackages: ["pg", "graphile-worker"] };
export default config;
