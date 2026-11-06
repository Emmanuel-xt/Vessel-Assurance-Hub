export const APP_NAME = "Vessel Assurance Hub";

import type { Role } from "@/lib/types";

// MOCK: demo mode turns on demo-only UI (quick-login, "Demo as" switcher, reset demo data).
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** MOCK: one-click demo accounts for the showcase (ids match the fixtures). Removed for production. */
export const DEMO_ACCOUNTS: { userId: string; role: Role; name: string }[] = [
  { userId: "usr-admin", role: "ADMIN", name: "Ngozi Adeyemi" },
  { userId: "usr-sup-tunde", role: "SUPERVISOR", name: "Tunde Bakare" },
  { userId: "usr-wkr-ibrahim", role: "WORKER", name: "Ibrahim Musa" },
];
