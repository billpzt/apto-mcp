import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // OAuth discovery documents must live at /.well-known/*, but Next's dev
  // file watcher (chokidar) ignores dot-prefixed directories by default, so
  // the routes are implemented under app/api/oauth/* and rewritten here.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata",
      },
    ];
  },
};

export default nextConfig;
