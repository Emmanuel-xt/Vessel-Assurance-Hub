import {
  Anchor,
  ArrowLeftRight,
  ArrowUpToLine,
  Box,
  ClipboardCheck,
  Compass,
  Container,
  Flame,
  Fuel,
  GraduationCap,
  Handshake,
  HeartPulse,
  Megaphone,
  PlugZap,
  Radar,
  ShieldCheck,
  Siren,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/** Icons for the seeded modules. Modules added by admins use the default clipboard. */
const ICONS: Record<string, LucideIcon> = {
  "mod-marine-start-work": Anchor,
  "mod-bridge-team": Compass,
  "mod-navigation-watch": Radar,
  "mod-personnel-transfer": ArrowLeftRight,
  "mod-cargo-operations": Container,
  "mod-bunkering": Fuel,
  "mod-security": ShieldCheck,
  "mod-occupational-health": HeartPulse,
  "mod-galley": UtensilsCrossed,
  "mod-working-at-height": ArrowUpToLine,
  "mod-confined-space-entry": Box,
  "mod-hot-work": Flame,
  "mod-energy-isolation": PlugZap,
  "mod-emergency-preparedness": Siren,
  "mod-leadership-engagement": Megaphone,
  "mod-contractor-management": Handshake,
  "mod-learning-action-closure": GraduationCap,
};

export function ModuleIcon({ moduleId, className }: { moduleId: string; className?: string }) {
  const Icon = ICONS[moduleId] ?? ClipboardCheck;
  return <Icon className={className} aria-hidden />;
}
