import type { RiskLevel } from "@/lib/types";

/** Risk badge colours. */
export const RISK_BADGE: Record<RiskLevel, string> = {
  LOW: "bg-sky-100 text-sky-900",
  MEDIUM: "bg-amber-100 text-amber-900",
  HIGH: "bg-red-600 text-white",
};

/** Selected risk button colours in the Raise finding sheet. */
export const RISK_SELECTED: Record<RiskLevel, string> = {
  LOW: "border-sky-700 bg-sky-700 text-white",
  MEDIUM: "border-amber-400 bg-amber-400 text-amber-950",
  HIGH: "border-red-600 bg-red-600 text-white",
};

/** Left border of a finding summary card. */
export const RISK_BORDER: Record<RiskLevel, string> = {
  LOW: "border-l-sky-500",
  MEDIUM: "border-l-amber-500",
  HIGH: "border-l-red-600",
};
