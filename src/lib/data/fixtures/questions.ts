// MOCK: seed question bank, written in the design document's first-person style (CLAUDE.md §7).
// - The document's 5 core questions open every task-based module (Start Work modules, Personnel Transfer,
//   Cargo Operations, Bunkering), where "fit for duty / stop the job / proceed safely" makes sense.
// - The owner's question lists are placed in the matching document modules; the rest are drafted by Claude
//   for the owner to review.
// - Critical controls weigh 2; everything else weighs 1.

import type { Question } from "@/lib/types";

interface Q {
  text: string;
  risk: string;
  critical?: boolean;
  evidence?: boolean;
  /** Vessel type ids this applies to; omit for all. */
  vesselTypes?: string[];
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
  "mod-marine-start-work": [
    ...CORE,
    { text: "I am satisfied everyone on this task is competent for their role.", risk: "rc-personal-safety", critical: true },
    { text: "I have checked the equipment for this task is certified and in date.", risk: "rc-process-safety", evidence: true },
    { text: "I have a valid permit to work in place and the permit process is being followed.", risk: "rc-process-safety", critical: true, evidence: true },
    { text: "I have reviewed the task risk assessment with the team.", risk: "rc-process-safety" },
    { text: "I attended a toolbox talk for this task.", risk: "rc-personal-safety" },
    { text: "I am wearing the PPE this task requires.", risk: "rc-personal-safety" },
    { text: "I have checked for SIMOPS conflicts with other activities nearby.", risk: "rc-marine-ops", critical: true },
  ],
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
  "mod-personnel-transfer": [
    ...CORE,
    { text: "I have confirmed the transfer method (basket, gangway or crew boat) is approved for today's conditions.", risk: "rc-marine-ops", critical: true },
    { text: "I have checked the weather and sea state are within transfer limits.", risk: "rc-marine-ops", critical: true },
    { text: "I am satisfied everyone transferring has been briefed and is wearing a lifejacket.", risk: "rc-personal-safety" },
  ],
  "mod-cargo-operations": [
    ...CORE,
    { text: "I have confirmed the lifting equipment and cargo units are certified and inspected.", risk: "rc-process-safety", critical: true, evidence: true },
    { text: "I know where the safe havens on deck are during lifting.", risk: "rc-personal-safety" },
    { text: "I am satisfied the deck cargo is secured and the deck plan is up to date.", risk: "rc-marine-ops" },
  ],
  "mod-bunkering": [
    ...CORE,
    { text: "I have completed the bunkering checklist with the other unit.", risk: "rc-environment", critical: true, evidence: true },
    { text: "I have confirmed the hoses and couplings are inspected and in date.", risk: "rc-environment", evidence: true },
    { text: "I know where the spill kit is and how to use it.", risk: "rc-environment" },
    { text: "I am satisfied the scuppers are plugged and spill controls are in place.", risk: "rc-environment", critical: true },
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
  "mod-working-at-height": [
    ...CORE,
    { text: "I have a working-at-height permit and a rescue plan in place.", risk: "rc-personal-safety", critical: true },
    { text: "I have inspected my harness and lanyard before use.", risk: "rc-personal-safety", evidence: true },
    { text: "I am satisfied dropped-object controls are in place below the work area.", risk: "rc-personal-safety", critical: true },
  ],
  "mod-confined-space-entry": [
    ...CORE,
    { text: "I have confirmed the atmosphere was tested and is safe for entry.", risk: "rc-process-safety", critical: true, evidence: true },
    { text: "I know who the standby person is and what the rescue plan is.", risk: "rc-personal-safety", critical: true },
    { text: "I am satisfied the entry permit and isolations are in place.", risk: "rc-process-safety", critical: true },
  ],
  "mod-hot-work": [
    ...CORE,
    { text: "I have confirmed gas testing was done and the area is clear of flammables.", risk: "rc-process-safety", critical: true, evidence: true },
    { text: "I know who the fire watch is and that firefighting equipment is ready.", risk: "rc-process-safety", critical: true },
    { text: "I have a hot work permit for this job.", risk: "rc-process-safety", critical: true },
  ],
  "mod-energy-isolation": [
    ...CORE,
    { text: "I have confirmed all energy sources are isolated and locked out.", risk: "rc-process-safety", critical: true, evidence: true },
    { text: "I have tested for zero energy before starting.", risk: "rc-process-safety", critical: true },
    { text: "I am satisfied the isolation is recorded on the permit.", risk: "rc-process-safety" },
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
    vesselTypeIds: q.vesselTypes ?? [],
    auditTypeIds: [],
    displayOrder: index + 1,
    active: true,
  })),
);
