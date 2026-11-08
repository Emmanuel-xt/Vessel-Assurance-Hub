import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones on the same Wi-Fi load the dev server (private LAN address ranges).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],

  // Old and shortcut URLs. Redirecting here (HTTP 307) instead of calling redirect() in a page avoids a client-side
  // navigation under the sticky top bar (Next logs "Skipping auto-scroll behavior…" for those).
  async redirects() {
    return [
      { source: "/admin", destination: "/admin/users", permanent: false },
      // The dashboard is shared with supervisors, so it lives at /dashboard.
      { source: "/admin/dashboard", destination: "/dashboard", permanent: false },
      // Moved to /assessments (Stage 11).
      { source: "/my/assessments", destination: "/assessments", permanent: false },
    ];
  },
};

export default nextConfig;
