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
      // Start Work Checks are joined from an auditor's check (Roles pass, 2026-11-16).
      {
        source: "/assess/new",
        has: [{ type: "query", key: "module", value: "start-work" }],
        destination: "/start-work",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
