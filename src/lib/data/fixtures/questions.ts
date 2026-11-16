// MOCK: seed question bank, written in the design document's first-person style (CLAUDE.md §7).
// - Start Work Check tasks use the owner's own sheets (start-work-checks.ts, 2026-11-16), with guidance.
// - The design document's 5 core questions open Cargo Operations, where "fit for duty / stop the job / proceed
//   safely" makes sense.
// - The owner's question lists are placed in the matching document modules; the rest are drafted by Claude
//   for the owner to review.
// - Critical controls weigh 2; everything else weighs 1.

import type { Question } from "@/lib/types";
import { START_WORK_BANK } from "./start-work-checks";

interface Q {
  text: string;
  risk: string;
  critical?: boolean;
  evidence?: boolean;
  /** Vessel type ids this applies to; omit for all. */
  vesselTypes?: string[];
  /** "How to check" lines (Start Work sheets). */
  guidance?: string[];
}

/** Every vessel type except unpowered cargo barges (no bridge, galley or navigation watch). */
const CREWED_VESSELS = ["vt-installation", "vt-ahts", "vt-psv", "vt-crew-boat", "vt-sev", "vt-flotel", "vt-hlv"];

const CORE: Q[] = [
  { text: "I am fit for duty and understand my role.", risk: "rc-personal-safety" },
  { text: "I have reviewed hazards and controls.", risk: "rc-process-safety", critical: true },
  { text: "I have confirmed communications are effective.", risk: "rc-marine-ops" },
  { text: "I know how to stop the job if conditions become unsafe.", risk: "rc-personal-safety", critical: true },
  { text: "I am satisfied the activity can proceed safely.", risk: "rc-personal-safety", critical: true },
];

const BANK: Record<string, Q[]> = {
  ...START_WORK_BANK,
  "mod-bridge-team": [
    { text: "I have tested the communication systems (VHF, UHF and internal) and they work.", risk: "rc-marine-ops", vesselTypes: CREWED_VESSELS },
    { text: "I am satisfied the bridge equipment is defect free, or defects are reported and controlled.", risk: "rc-marine-ops", evidence: true, vesselTypes: CREWED_VESSELS },
    { text: "I have confirmed the vessel's statutory certificates are valid and in date.", risk: "rc-marine-ops", evidence: true },
    { text: "I know the Master's standing orders and night orders.", risk: "rc-marine-ops", vesselTypes: CREWED_VESSELS },
    { text: "I am satisfied the bridge is manned to the agreed level for current operations.", risk: "rc-marine-ops", critical: true, vesselTypes: CREWED_VESSELS },
  ],
  "mod-navigation-watch": [
    { text: "I have confirmed the navigation systems (radar, GPS, ECDIS and AIS) are operational.", risk: "rc-marine-ops", critical: true, vesselTypes: CREWED_VESSELS },
    { text: "I have confirmed the passage plan is approved and briefed.", risk: "rc-marine-ops", evidence: true, vesselTypes: CREWED_VESSELS },
    { text: "I have reviewed the weather forecast and the operating limits for this watch.", risk: "rc-marine-ops", vesselTypes: CREWED_VESSELS },
    { text: "I know the 500 m zone entry procedure for the installation.", risk: "rc-marine-ops", critical: true, vesselTypes: CREWED_VESSELS },
    { text: "I am satisfied the watch handover was complete and recorded.", risk: "rc-marine-ops", vesselTypes: CREWED_VESSELS },
  ],
  "mod-cargo-operations": [
    ...CORE,
    { text: "I have confirmed the lifting equipment and cargo units are certified and inspected.", risk: "rc-process-safety", critical: true, evidence: true },
    { text: "I know where the safe havens on deck are during lifting.", risk: "rc-personal-safety" },
    { text: "I am satisfied the deck cargo is secured and the deck plan is up to date.", risk: "rc-marine-ops" },
  ],
  "mod-security": [
    { text: "I have checked access control to the vessel is working.", risk: "rc-security", critical: true },
    { text: "I have checked the visitor register is maintained.", risk: "rc-security", evidence: true },
    { text: "I have taken part in a security drill within the required period.", risk: "rc-security" },
    { text: "I know the current security threat level and what it means for me.", risk: "rc-security", critical: true },
    { text: "I have confirmed restricted areas are secured.", risk: "rc-security" },
  ],
  "mod-occupational-health": [
    { text: "I have confirmed the potable water has been tested and the results are acceptable.", risk: "rc-health", evidence: true },
    { text: "I am satisfied medical supplies are available and in date.", risk: "rc-health" },
    { text: "I am satisfied crew fatigue is monitored and work-rest hours are followed.", risk: "rc-health", critical: true },
    { text: "I know how to report a health concern or illness on board.", risk: "rc-health" },
    { text: "I am satisfied noise and chemical exposure controls are in place.", risk: "rc-health" },
  ],
  "mod-galley": [
    { text: "I am satisfied galley hygiene is acceptable.", risk: "rc-health", evidence: true, vesselTypes: CREWED_VESSELS },
    { text: "I have checked food storage is compliant, with temperatures logged and dates in order.", risk: "rc-health", evidence: true, vesselTypes: CREWED_VESSELS },
    { text: "I have confirmed galley fire safety equipment (fire blanket, extinguisher, clean extraction hood) is in place.", risk: "rc-personal-safety", vesselTypes: CREWED_VESSELS },
    { text: "I am satisfied galley staff hold valid food-handling certificates.", risk: "rc-health", vesselTypes: CREWED_VESSELS },
  ],
  "mod-emergency-preparedness": [
    { text: "I have checked lifesaving equipment is inspected and in date.", risk: "rc-personal-safety", evidence: true },
    { text: "I have checked firefighting equipment is available and ready for use.", risk: "rc-personal-safety", critical: true, evidence: true },
    { text: "I am satisfied safety drills are current.", risk: "rc-personal-safety" },
    { text: "I know my muster station and my duties on the muster list.", risk: "rc-personal-safety", critical: true },
    { text: "I am satisfied the emergency response plan is current and bridged with the installation.", risk: "rc-marine-ops" },
  ],
  "mod-leadership-engagement": [
    { text: "I have seen leaders carry out workforce engagement on board.", risk: "rc-personal-safety" },
    { text: "I can explain my Stop Work Authority and when to use it.", risk: "rc-personal-safety", critical: true },
    { text: "I am satisfied toolbox talks are effective.", risk: "rc-personal-safety" },
    { text: "I understand the recent learning points shared with the crew.", risk: "rc-personal-safety" },
    { text: "I feel comfortable raising safety concerns.", risk: "rc-personal-safety", critical: true },
  ],
  "mod-contractor-management": [
    { text: "I have confirmed contractor personnel have completed the site induction.", risk: "rc-personal-safety" },
    { text: "I am satisfied contractor competence records are verified for their roles.", risk: "rc-personal-safety", evidence: true },
    { text: "I know who the contractor's supervisor is and how to reach them.", risk: "rc-personal-safety" },
    { text: "I am satisfied contractor work is covered by the vessel's permit and bridging arrangements.", risk: "rc-process-safety", critical: true },
  ],
  "mod-learning-action-closure": [
    { text: "I have seen recent incident learnings shared on board.", risk: "rc-personal-safety" },
    { text: "I am satisfied actions from previous findings are closed with evidence.", risk: "rc-process-safety", evidence: true },
    { text: "I know how to report a near miss or hazard.", risk: "rc-personal-safety" },
    { text: "I am satisfied overdue actions are escalated to the right person.", risk: "rc-process-safety" },
  ],
};

export const QUESTIONS: Question[] = Object.entries(BANK).flatMap(([moduleId, questions]) =>
  questions.map((q, index) => ({
    id: `q-${moduleId.replace(/^mod-/, "")}-${String(index + 1).padStart(2, "0")}`,
    moduleId,
    text: q.text,
    riskCategoryId: q.risk,
    weight: q.critical ? 2 : 1,
    criticalControl: q.critical ?? false,
    evidenceRequired: q.evidence ?? false,
    guidance: (q.guidance ?? []).join("\n"),
    vesselTypeIds: q.vesselTypes ?? [],
    auditTypeIds: [],
    displayOrder: index + 1,
    active: true,
  })),
);
