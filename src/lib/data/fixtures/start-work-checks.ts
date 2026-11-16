// MOCK seed: the owner's Start Work Check sheets (docs/Start Work Checks/, supplied 2026-11-16), one entry per task.
// - Marine sheets: Deck Work and Bunkering (Marine Start Work Checks addendum), Offshore Personnel Transfer.
// - IOGP Life-Saving Rule Start-Work Checks: the 14 other tasks, with each item's "How to (examples)" as guidance.
// Wording is kept as written. Bullet lists inside an item are joined into one sentence; the sheets' Yes/No branch items
// ("Does Hot Work require Energy Isolation?") become a confirmation answered Yes / No / N/A, with the follow-up moved
// into the guidance. Bunkering item 6 repeated item 3 and was dropped. Critical controls = the key barriers agreed with
// the owner (1–3 per task). No client name, project name or document number is copied into the app.
//
// Guidance lines: plain = bullet, "- " = sub-bullet, "Note: " = note.

export interface StartWorkItem {
  text: string;
  risk: string;
  critical?: boolean;
  guidance?: string[];
}

const PERSONAL = "rc-personal-safety";
const PROCESS = "rc-process-safety";
const MARINE = "rc-marine-ops";
const ENVIRONMENT = "rc-environment";

const TASK_RISK_ASSESSMENT = [
  "Complete a task risk assessment specific to the scope of work",
  "Discuss hazards with the work team prior to the start of work",
  "Check for simultaneous operations that may introduce additional hazards",
];

const RESCUE_CREW = ["The rescue crew:", "- is available", "- is aware of specific hazards related to this task", "- can execute the rescue plan"];

const ENERGY_ISOLATION_FIRST = (task: string, purge: string): StartWorkItem => ({
  text: `The ${task} has been evaluated for energy isolation requirements (if isolation is needed, the Energy Isolation Start Work Check is also completed).`,
  risk: PROCESS,
  guidance: [
    `If the ${task} requires energy isolation, complete the Energy Isolation Start Work Check as well.`,
    "All potential energy sources have been identified, isolated and locked and tagged per isolation plan.",
    purge,
  ],
});

export const START_WORK_BANK: Record<string, StartWorkItem[]> = {
  // ---------- Marine ----------
  "mod-deck-work": [
    { text: "I am fit for duty and ready to work safely today.", risk: PERSONAL },
    { text: "I understand today's work scope and my role.", risk: PERSONAL },
    { text: "I understand the requirements of the Permit to Work and the controls applicable to my task.", risk: PROCESS, critical: true },
    { text: "I understand other activities going on around my work location and how these impact me.", risk: MARINE },
    { text: "I have verified that emergency equipment is available and ready for use if required. Emergency escape routes and muster points are known and accessible.", risk: PERSONAL },
    { text: "I understand the hazards and controls associated with my task (including environmental and pollution risks).", risk: PERSONAL, critical: true },
    { text: "I am competent for the task.", risk: PERSONAL },
    { text: "I have checked that the communication equipment is operational. The correct working channel is agreed with the bridge and engine room.", risk: MARINE },
    { text: "I have checked that tools and equipment are fit for purpose.", risk: PERSONAL },
    { text: "The work area has been inspected and is safe to start work.", risk: PERSONAL },
    { text: "I am satisfied that lighting and visibility are adequate to perform the task safely.", risk: PERSONAL },
    { text: "I am using the correct PPE for my task.", risk: PERSONAL },
    { text: "I will follow approved lifting and line-of-fire controls.", risk: PERSONAL, critical: true },
    { text: "I have taken the necessary precautions for working at height, where applicable.", risk: PERSONAL },
    { text: "I have checked that all loose items and dropped-object hazards have been secured.", risk: PERSONAL },
    { text: "I understand and will use Stop Work Authority when necessary.", risk: PERSONAL },
    { text: "I have confirmed access control to the vessel is managed and fit for purpose; expected external visitors have been made known to me.", risk: "rc-security" },
    { text: "I understand the nature of cargo work planned for today (dangerous goods, dry / liquid, etc.) with relevant departments informed.", risk: MARINE },
    { text: "I have confirmed that quayside conditions (when alongside) are suitable for my planned activities.", risk: MARINE },
    { text: "I understand how current weather and sea conditions may affect my work.", risk: MARINE },
  ],
  "mod-bunkering": [
    { text: "I have reviewed the bunkering checklist. I understand the bunkering plan, my responsibilities, and the limits of the transfer operation.", risk: ENVIRONMENT },
    { text: "I have verified that all communications are operational and understand the emergency communication process.", risk: MARINE },
    { text: "I have inspected the transfer hoses and am satisfied they are fit for service.", risk: ENVIRONMENT, critical: true },
    { text: "I have verified that hose certificates and inspection records are valid and available.", risk: ENVIRONMENT },
    { text: "I understand the emergency shutdown arrangements and my role if an emergency occurs.", risk: PROCESS, critical: true },
    { text: "I have verified that tank capacities, transfer limits, and expected transfer volumes have been communicated and understood.", risk: ENVIRONMENT },
    { text: "I understand the agreed transfer rate and the conditions requiring slowdown or shutdown.", risk: ENVIRONMENT },
    { text: "I participated in the pre-transfer meeting / toolbox talk.", risk: PERSONAL },
    { text: "I have confirmed that fenders, where required, are in good condition and in place.", risk: MARINE },
    { text: "I have confirmed that the mooring arrangement between the vessels is satisfactory.", risk: MARINE },
    { text: "Save-alls and drip trays are correctly positioned.", risk: ENVIRONMENT },
    { text: "Scuppers are plugged and spill containment arrangements are ready.", risk: ENVIRONMENT, critical: true },
    { text: "Oil spill response equipment is available and ready for use.", risk: ENVIRONMENT },
    { text: "Tank capacities and transfer limits have been confirmed.", risk: ENVIRONMENT },
    { text: "Weather and environmental conditions are suitable for transfer and are continuously monitored.", risk: MARINE },
    { text: "The interfacing facility has been informed and agreed to commence bunkering.", risk: MARINE },
    { text: "I am satisfied that all safety precautions have been implemented and bunkering can commence safely.", risk: ENVIRONMENT },
    { text: "I have raised any safety concerns, uncertainties, or changes that could affect the safe execution of this work.", risk: PERSONAL },
  ],
  "mod-personnel-transfer": [
    { text: "I am fit for duty and understand my role in the personnel transfer operation.", risk: PERSONAL },
    { text: "I have participated in, or received, the personnel transfer briefing and understand the transfer plan.", risk: MARINE },
    { text: "I have confirmed that the supervisors / persons in charge on both the departing and receiving facilities are ready for the transfer to proceed.", risk: MARINE },
    { text: "I have confirmed that communications between the transfer vessel, the departing facility, and the receiving facility have been tested and are working effectively.", risk: MARINE },
    { text: "I have confirmed that weather, sea state, vessel motions, and other environmental conditions are acceptable for the transfer and will continue to be monitored during the operation.", risk: MARINE, critical: true },
    { text: "I have confirmed that personnel transfer equipment and landing areas have been inspected and are fit for use.", risk: MARINE, critical: true },
    { text: "I have confirmed that all personnel involved are wearing the required PPE and have received the necessary transfer instructions.", risk: PERSONAL, critical: true },
    { text: "I have reviewed the key hazards and controls, including line-of-fire, dropped-object, slips/trips, and man-overboard risks.", risk: PERSONAL },
    { text: "I have confirmed that emergency response arrangements and rescue plans are understood by all parties involved.", risk: PERSONAL },
    { text: "I know how to raise an alarm, stop the transfer, or intervene if conditions become unsafe.", risk: PERSONAL },
    { text: "I have confirmed that all persons participating in the transfer are ready and the transfer can proceed safely.", risk: MARINE },
    { text: "I am satisfied that the personnel transfer can commence safely.", risk: MARINE },
  ],

  // ---------- IOGP Life-Saving Rules ----------
  "mod-mechanical-lifting": [
    {
      text: "The lift has been planned.",
      risk: PERSONAL,
      guidance: [
        "The lift method, equipment and number of people required has been assessed and determined.",
        "When required, an approved lift plan or procedure is in place and has been evaluated by a competent person.",
        "The lift has been assessed for:",
        "- load weight",
        "- load size",
        "- centre of gravity (e.g., lifting points)",
        "The lifting equipment's current capacity and condition has been assessed.",
        "Equipment operator and lifting crew have discussed the written lift plan prior to making a lift.",
      ],
    },
    {
      text: "The hazards are identified and controlled.",
      risk: PERSONAL,
      guidance: [
        "Complete a task risk assessment specific to the scope of work",
        "Discuss hazards with the work team prior to the start of work",
        "Identify overhead hazards and/or other obstructions (e.g., overhead power lines), making sure to check:",
        "- load path",
        "- swing radius",
        "- overhead hazards",
        "- pickup/lay-down zones",
        "Check for simultaneous operations that may introduce any additional hazards.",
        "Discuss stop work considerations if work situation changes, including change of weather",
        "Note: Consider how to apply \"hands free lifting\" (e.g. use of push poles and/or taglines).",
      ],
    },
    {
      text: "Workers involved with the lift are qualified to perform their task.",
      risk: PERSONAL,
      guidance: [
        "Lifting equipment operator and lifting crew are qualified to perform their task.",
        "Note: To be \"qualified\" may require certification and/or assessment to meet company or applicable legal requirements.",
      ],
    },
    {
      text: "The lifting equipment is stable and potential for unplanned movement has been assessed.",
      risk: PERSONAL,
      guidance: [
        "Lifting appliance is level and/or placed on stable ground.",
        "Matting has been assessed for stability and is level for the lifting equipment.",
        "Outriggers are deployed.",
        "Loads have been assessed for stability, taking into account:",
        "- load securing",
        "- workplace conditions / equipment capacity",
        "- travel path",
        "Equipment is operated per OEM requirements (e.g., weather, sea state and temperature).",
      ],
    },
    {
      text: "The lifting and rigging equipment is certified, inspected and rated for the lift.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Pre-use crane inspection has been completed",
        "Safety and monitoring devices are in place and functioning",
        "Manufacturer's load chart is available",
        "The rigging equipment has been inspected prior to lift",
        "The rigging equipment is rated for the lift",
        "Note: If a load chart does not exist, assume the equipment is not rated for the lift. Stop work and identify alternative lifting equipment that is rated for the load.",
      ],
    },
    {
      text: "A communication plan and responsibilities are agreed to by the lift crew.",
      risk: PERSONAL,
      guidance: [
        "Communication method(s) (e.g., hand signals, radio) have been agreed to and tested.",
        "Equipment operator and lifting crew have discussed the emergency response, including what emergency stop signals will be used.",
        "The person in charge of the lift has been identified as per the lift plan or procedure.",
        "The members of the lift crew have agreed to their individual roles and responsibilities for the lift.",
        "The signaller for the lift has been identified (banksman/flagman/dogman/spotter).",
      ],
    },
    {
      text: "The load has been inspected prior to lift.",
      risk: PERSONAL,
      guidance: [
        "Every load has been inspected for integrity and stability (e.g., centre of gravity)",
        "- The load and its packaging can withstand the forces/motion caused by the lift",
        "Loose objects have been secured or removed prior to lift",
        "Loose and small objects are well packaged or placed in a lifting basket",
      ],
    },
    {
      text: "Barriers and exclusion zones are in place.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Exclusion zones have been identified and controls are in place to protect people from line of fire hazards:",
        "- working under suspended loads",
        "- moving objects",
        "- dropped objects",
        "Access to exclusion zones is controlled (e.g., attendant or physical barriers)",
        "Escape routes are unobstructed and known by the work crew",
      ],
    },
  ],
  "mod-working-at-height": [
    { text: "The hazards are identified, controlled and it is safe to start.", risk: PERSONAL, guidance: TASK_RISK_ASSESSMENT },
    {
      text: "My fall protection equipment is certified, inspected, rated and fit for the task.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Fall protection equipment includes fall arrest and/or fall restraint",
        "Full body harness is load rated to support the weight of the worker",
        "Check every strap, buckle, fitting and/or grommet for signs of wear on the fall protection harness.",
        "Fall arrest system contains a self-retracting lifeline or shock absorbing lanyard",
        "Fall restraint contains a fixed lifeline configured to prevent the worker from reaching the edge and falling",
        "Fall arrest is shorter than the potential fall distance",
        "Note: Stop and notify your supervisor if the fall protection equipment has excessive wear/damage/mechanical malfunction or is not fit for the task.",
      ],
    },
    {
      text: "The fall protection harness is adjusted to fit.",
      risk: PERSONAL,
      guidance: [
        "Only full body harnesses are used",
        "Harness straps are not twisted",
        "Harness body straps are adjusted for close body fit (i.e., no slack)",
        "Note: Use of body belts is not allowed.",
      ],
    },
    {
      text: "The approved anchor point(s) are in place for 100% tie off.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "100% tie off can occur outside of protected areas (such as an elevated work area not enclosed by handrails)",
        "The anchor point meets regulatory/company requirements",
        "The position(s) of anchor points allow for 100% tie off",
        "The number of anchor points available allows for 100% tie off",
        "Pull on the connecting device to test if the attachment is secure.",
        "Note: Confirm anyone working at height is 100% tied off at all times (e.g., at least one hook must be anchored at all times).",
      ],
    },
    {
      text: "If a fall occurs, the fall path is clear.",
      risk: PERSONAL,
      guidance: [
        "Fall protection is fit for purpose to protect the worker if they fall",
        "Fall arrest distance is shorter than the fall distance to the first obstruction",
        "If the worker is likely to swing, check that the path is free of obstructions",
        "Mobile obstructions have been removed from the fall path",
      ],
    },
    {
      text: "The tools/materials being used at height are secured.",
      risk: PERSONAL,
      guidance: [
        "Tools used at height have securing wire/lanyards/tethers",
        "Materials used at height are secured in storage boxes, pouches, bags etc.",
        "Cover openings to lower levels (e.g., grating, gaps etc.) or use debris nets",
        "Note: Follow the site/company dropped object prevention program (e.g., Work at Height tool register).",
      ],
    },
    {
      text: "Barriers and drop/exclusion zones are in place.",
      risk: PERSONAL,
      guidance: [
        "Identify drop/exclusion zones",
        "Control access to drop/exclusion zones during work at height (e.g., attendant or physical barriers)",
      ],
    },
    {
      text: "The rescue plan is in place and is ready to be used.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "The work crew has discussed the rescue plan, including:",
        "- How to start the rescue response",
        "- Location of rescue equipment and responders",
        ...RESCUE_CREW,
      ],
    },
  ],
  "mod-hot-work": [
    ENERGY_ISOLATION_FIRST("Hot Work", "The system has been drained, flushed, or purged to remove flammable/explosive materials or gases."),
    {
      text: "The hazards have been identified, controlled and it is safe to start.",
      risk: PROCESS,
      guidance: [
        "Complete a task risk assessment specific to the scope of work",
        "Discuss hazards with the work team prior to the start of work",
        "Check for simultaneous operations that may introduce any additional hazards",
      ],
    },
    {
      text: "If the Hot Work is in a hazardous area, the initial gas test has been completed (N/A if not in a hazardous area).",
      risk: PROCESS,
      critical: true,
      guidance: [
        "The initial gas test has been completed by a Qualified Gas Tester:",
        "- At all openings below and above the hot work area",
        "- At a minimum distance around the hot work area",
        "Gas readings are within the required range",
        "If the Hot Work is not in a hazardous area, answer N/A here and on the next item.",
        "Note: Confirm gas testing outside of a defined hazardous area if required for other reasons. Gas testing should comply with company requirements and applicable regulations.",
      ],
    },
    {
      text: "The Hot Work atmosphere will be continually monitored (N/A if not in a hazardous area).",
      risk: PROCESS,
      guidance: [
        "Follow-up test frequency is documented (e.g., permit) before starting work.",
        "Note: \"Continually\" monitored means periodic monitoring of the atmosphere with a defined frequency, or continuous monitoring throughout the duration of work activities.",
      ],
    },
    {
      text: "Ignition sources are identified and controlled.",
      risk: PROCESS,
      critical: true,
      guidance: [
        "Barriers are in place to prevent ignition in the hot work area:",
        "- Drains, gaps, openings in tanks or piping have been covered/sealed",
        "- Vents are isolated/routed away from the area",
        "A trained Fire Watch has been designated and is at the work location.",
        "Firefighting equipment is inspected, on site and fully functional.",
      ],
    },
    {
      text: "Flammable/combustible materials have been removed or isolated.",
      risk: PROCESS,
      critical: true,
      guidance: [
        "All flammable/combustible materials have been removed or, if not removed, measures (e.g., fire blankets) are in place to shield them from ignition sources",
      ],
    },
  ],
  "mod-energy-isolation": [
    {
      text: "The circuit, system, and/or equipment to be worked on is identified in the isolation plan or drawing.",
      risk: PROCESS,
      guidance: ["Tags or markings identify the circuit, system and/or equipment indicated by the isolation plan or drawing."],
    },
    {
      text: "All hazardous energy sources have been identified.",
      risk: PROCESS,
      guidance: [
        "Complete a task risk assessment specific to the scope of work",
        "Discuss hazards with the work team prior to starting work",
        "Inspect equipment for potential energy sources (e.g., electrical, pressure, hydraulic, mechanical, etc.)",
        "Identify and mitigate hazards on any nearby energised circuits/systems/equipment",
      ],
    },
    {
      text: "Isolation points are identified per the isolation plan and/or drawing.",
      risk: PROCESS,
      guidance: [
        "All isolation points are in place and tagged or marked (i.e., use isolation diagram, Equipment Isolation Procedure, P&IDs, or Process Flow Diagrams).",
      ],
    },
    {
      text: "Isolation devices are set in the identified position per the isolation plan or drawing.",
      risk: PROCESS,
      guidance: [
        "Valves are open or closed per the diagram and/or plan.",
        "Blinds, spades and skillets are:",
        "- stamped or certified for the pressure rating of the equipment",
        "- installed per the diagram and/or plan",
        "Electrical isolation points are open/switched off or disconnected from the power source",
      ],
    },
    {
      text: "The locks and tags are installed on the equipment/devices per the isolation plan.",
      risk: PROCESS,
      critical: true,
      guidance: [
        "All isolations are in place and tagged or marked (i.e., use isolation diagram, Equipment Isolation Procedure, P&IDs, or Process Flow Diagrams).",
        "Lock out tag out devices are on isolation points",
        "Keys are in a designated secure location",
        "Note: If a lock is unable to be placed, confirm hazardous energy source points are isolated and secured per the isolation plan.",
      ],
    },
    {
      text: "Zero energy state has been verified, proven and demonstrated.",
      risk: PROCESS,
      critical: true,
      guidance: [
        "Demonstrate powered equipment cannot be started.",
        "Systems (lines, gauges, etc.) have been tested for residual or stored energy:",
        "- Check bleed and vent points are open to release stored energy",
        "- Check gauges, measurements & volt meters",
        "Note: If zero energy is not possible, STOP and confirm controls/safeguards are in place, functioning, operated and maintained to manage the risk from residual energy.",
      ],
    },
  ],
  "mod-de-isolation": [
    {
      text: "The circuit, system, and/or equipment to be de-isolated/re-energised is the one identified in the isolation plan or drawing.",
      risk: PROCESS,
      guidance: [
        "Tags or markings identify the circuit, system and/or equipment to be de-isolated/re-energised.",
        "Note: Confirm the circuit, system, and/or equipment is ready to be de-isolated and re-energised (e.g. all work has been completed).",
      ],
    },
    {
      text: "Isolation devices are removed per the isolation plan or drawing.",
      risk: PROCESS,
      critical: true,
      guidance: [
        "Physically inspect:",
        "- The work area, to confirm all mechanical, process and electrical isolations were removed per plan",
        "- Bleed and vent points, to confirm they are closed/open per plan or procedure",
      ],
    },
    {
      text: "Any personnel affected by the re-energising activity have been notified.",
      risk: PROCESS,
      critical: true,
      guidance: [
        "Personnel in/near the work area or affected by the re-energising of the circuit, system, and/or equipment are aware it is ready to be put back in service.",
        "Personnel are not in the line of fire of re-energised potential hazardous energy sources (e.g., electrical, pressure, hydraulic, mechanical etc.)",
      ],
    },
    {
      text: "The circuit, system, and/or equipment has been re-energised per plan or drawing.",
      risk: PROCESS,
      guidance: ["The circuit, system, and/or equipment has been re-energised per the isolation plan or system/equipment operating procedure."],
    },
  ],
  "mod-confined-space-entry": [
    ENERGY_ISOLATION_FIRST("confined space", "The system has been drained, flushed, or purged to remove explosive materials or gases."),
    {
      text: "The hazards have been identified, controlled and it is safe to start.",
      risk: PERSONAL,
      guidance: TASK_RISK_ASSESSMENT,
    },
    {
      text: "Gas testing frequency has been established.",
      risk: PROCESS,
      critical: true,
      guidance: [
        "Gas testing is being done by a Qualified Gas Tester",
        "Initial gas testing and the required follow-up testing frequency are done before starting work.",
        "Check testing results and agree on a schedule for follow-up testing before starting work",
      ],
    },
    {
      text: "Ventilation is in place and working.",
      risk: PROCESS,
      guidance: [
        "The confined space is continuously ventilated",
        "If using mechanical ventilation:",
        "- The flexible ducting is arranged so there is continuous air flow in the entire space",
        "- Equipment is bonded and grounded to prevent static electricity hazards",
        "Ventilation inlets:",
        "- are not near an ignition source",
        "- will not be affected by wind/weather conditions and will not have flow restrictions",
        "- will not draw contaminated air into the space (e.g., vehicle, generator exhaust)",
      ],
    },
    {
      text: "An attendant is in place and the method of communication is agreed to and tested prior to entry.",
      risk: PERSONAL,
      guidance: [
        "A dedicated attendant is present at the designated entry point(s) to the confined space.",
        "Ask the attendant to describe their responsibilities, which include:",
        "- Using previously agreed communication methods (e.g., hand signals, radio)",
        "- Monitoring personnel in the confined space",
        "- Documenting entries and exits from the confined space",
        "- Monitoring the confined space for changing conditions",
        "- Initiating the emergency rescue response if needed",
      ],
    },
    {
      text: "My breathing apparatus is in good working condition (N/A if no breathing apparatus is required).",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "The breathing apparatus is complete, certified and in good working condition",
        "The main air supply is correct and properly connected before using it.",
        "The escape pack is in place and functioning prior to entry.",
      ],
    },
    {
      text: "The rescue plan is in place and ready to be used.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Discuss the method of communication with the attendant & rescue team prior to entry.",
        "Rescue equipment is at the job site",
        "The entrant is wearing rescue equipment per plan (e.g., harnesses, retrieval device).",
        ...RESCUE_CREW,
      ],
    },
  ],
  "mod-energised-electrical": [
    {
      text: "The authorised work scope has been reviewed and agreed to.",
      risk: PROCESS,
      guidance: ["Review the work scope per the approved work permit.", "Discuss stop work considerations if the work situation changes."],
    },
    {
      text: "The circuit/equipment to be worked on is the one identified in the plan.",
      risk: PROCESS,
      guidance: ["The equipment to be worked on is confirmed correct using tag numbers or cable markings."],
    },
    {
      text: "Personnel are wearing PPE rated for the electrical hazard and the electrical voltage before entering any access-restricted area.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "The crew has knowledge of electrical hazards (e.g., voltage, single phase/three phase and arc flash).",
        "Personnel are wearing PPE rated for the electrical voltage (i.e., arc flash) before entering the restricted approach boundary, and it has been inspected and is free from damage.",
      ],
    },
    {
      text: "Restricted access zones have been identified and barricaded.",
      risk: PERSONAL,
      guidance: [
        "Restrict access to defined areas according to company policy and/or applicable regulatory requirements (e.g., NFPA 70E)",
        "Barriers are in place to limit access to the work area",
        "The work area is monitored to prevent unauthorised access",
      ],
    },
    {
      text: "An electrical standby person is in place during work activities (N/A if an electrical standby is not required).",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Dedicated electrical person(s) are present at the work area according to company policy and/or applicable regulatory requirements (e.g., NFPA 70E). Their responsibilities include:",
        "- Monitor personnel entering the restricted area",
        "- Monitor the area for changing conditions",
        "- Initiate the emergency rescue response if needed",
      ],
    },
    {
      text: "A communication plan with the electrical standby person has been agreed to.",
      risk: PERSONAL,
      guidance: [
        "A communication plan has been discussed with qualified electricians",
        "The communication plan has been agreed to and tested with the work crew:",
        "- Stop work signals",
        "- How to initiate the emergency response plan",
      ],
    },
    {
      text: "The insulated tools and testing equipment are certified, inspected, free from damage and rated for the task.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Insulating materials such as rubber matting or screening are in place.",
        "Only insulated tools that have been rated/certified for the equipment's maximum voltage are used.",
        "Conduct a voltage function test prior to using testing equipment.",
      ],
    },
    {
      text: "An emergency response plan is in place and is ready to be used.",
      risk: PERSONAL,
      guidance: [
        "All emergency equipment required by the plan is at the worksite (e.g., electrical safety hooks, insulated gloves, extinguisher for electrical fire etc.)",
        "Discuss the method of communication with the electrical standby person & rescue team.",
        "Rescue equipment is at the job site",
        "The rescue team:",
        "- is available",
        "- is aware of specific hazards related to this task",
        "- can execute the rescue plan",
      ],
    },
  ],
  "mod-man-riding": [
    {
      text: "Personnel involved with the man-riding operations are qualified to perform their task.",
      risk: PERSONAL,
      guidance: ["Rider, winch operator and spotter have all been trained and can describe their responsibilities"],
    },
    {
      text: "The man-riding equipment is certified, inspected and rated for the task.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Winch: certified \"suitable\" for man-riding",
        "Rigging equipment, including cable, inspected for wear/defects",
        "Harness: inspected per work at height requirements",
        "Fall arrest gear (if used): inspected",
      ],
    },
    {
      text: "All rotating or moving equipment close to man-riding activities is secured to prevent unplanned movement.",
      risk: PERSONAL,
      guidance: [
        "Hoisting and rotating equipment in the immediate area and at different levels is not moving (e.g., set the brake for the travelling block, lock out tag out)",
      ],
    },
    {
      text: "Communication methods have been agreed to by the workers.",
      risk: PERSONAL,
      guidance: [
        "Communication methods agreed to and tested for movement of the rider (i.e., hand signals and radios)",
        "- Confirm a common set of signals is used by the work crew",
      ],
    },
    {
      text: "The tools/materials being used at height are secured.",
      risk: PERSONAL,
      guidance: [
        "Tools used at height have securing wire/lanyards/tethers",
        "Materials used at height are secured in storage boxes, pouches, bags etc.",
        "Cover openings to lower levels (e.g., grating, gaps etc.) or use debris nets",
        "Note: Follow the site/company dropped object prevention program (e.g., Work at Height tool register).",
      ],
    },
    {
      text: "Barriers and drop/exclusion zones are in place.",
      risk: PERSONAL,
      guidance: [
        "Establish drop/exclusion zones",
        "Control access to drop/exclusion zones during work at height (e.g. attendant or physical barriers)",
      ],
    },
    {
      text: "The rescue plan is in place and is ready to be used.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Confirm the work crew has discussed the rescue plan, including:",
        "- How to start the rescue response",
        "- Location of rescue equipment and responders",
        ...RESCUE_CREW,
      ],
    },
  ],
  "mod-work-near-water": [
    {
      text: "The hazards have been identified, controlled and it is safe to start.",
      risk: PERSONAL,
      guidance: [
        ...TASK_RISK_ASSESSMENT,
        "Controls/safeguards for working close to an unprotected edge near water have been considered:",
        "- fall protection equipment (e.g. safety lines, travel restraints, fall arrest)",
        "- temporary edge protection (e.g. chains, ropes)",
      ],
    },
    {
      text: "Exclusion/restricted zones are identified to notify workers of the unguarded edge.",
      risk: PERSONAL,
      guidance: [
        "Exclusion/restricted zones are identified (e.g. signage, tape, rope and/or yellow lines)",
        "Authorised access to exclusion/restricted zones is controlled (e.g. attendant or temporary physical barriers)",
      ],
    },
    {
      text: "Workers authorised to enter the exclusion/restricted zones are wearing Personal Flotation Devices (PFDs).",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Each PFD being worn is:",
        "- approved, maintained & certified",
        "- fit for the user and task",
        "Each PFD has been inspected for:",
        "- damage",
        "- waterlogging",
        "- air leaks",
      ],
    },
    {
      text: "Walking surfaces are in good condition and escape routes are unobstructed.",
      risk: PERSONAL,
      guidance: [
        "Trip and slip hazards are controlled:",
        "- high visibility markings",
        "- non-slip deck/floor surface (e.g. coating, stick-on strips, sand paint)",
        "- non-slip footwear for slippery surfaces",
        "- clear of snow and ice",
        "- clear of oil, grease and chemicals",
        "- lighting is in place where needed",
      ],
    },
    {
      text: "A communication plan is in place and responsibilities agreed.",
      risk: PERSONAL,
      guidance: [
        "Communication method(s), primary and secondary (e.g. radio, phone, hand signals), have been tested.",
        "The person in charge has been identified as per the plan or procedure.",
        "The worker(s) have agreed to their individual roles and responsibilities",
        "If applicable, the signaller has been identified",
      ],
    },
    {
      text: "The rescue plan is in place and is ready to be used.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "The rescue plan has been discussed, including:",
        "- how to start the rescue response for person(s) in the water",
        "- location of rescue equipment (i.e. fast rescue craft, pole hooks, life rings)",
        "The rescue crew:",
        "- is available",
        "- is aware of specific hazards related to this rescue",
        "- can execute the rescue plan for the environment (e.g. stationary vs moving vessels, fixed dock / jetty, water flow/current, sea state)",
        "Escape routes are unobstructed",
      ],
    },
  ],
  "mod-mobile-equipment": [
    {
      text: "Mobile equipment parking areas and travel paths have been identified for the work site.",
      risk: PERSONAL,
      guidance: [
        "Mobile equipment has:",
        "- a designated parking area",
        "- lighting in place for night or low visibility prior to movement",
        "- side and overhead clearance",
        "- clearly posted and enforced speed restrictions",
      ],
    },
    {
      text: "Controls/safeguards are in place to keep pedestrians away from mobile equipment.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Interaction between workers and mobile equipment is eliminated or minimised by:",
        "- dedicated walkways/paths",
        "- signage and barriers separating pedestrians from mobile equipment paths",
        "- clearly defined pedestrian crossing points",
      ],
    },
    {
      text: "Mobile equipment has been inspected.",
      risk: PERSONAL,
      guidance: [
        "Pre-mobilisation and periodic site equipment inspections are conducted and have checked for:",
        "- signs of leaks",
        "- damage",
        "- brake functionality test",
        "Safety devices such as alarms, seats and back-up alarms are functioning.",
        "Defective equipment is tagged and removed from operation",
      ],
    },
    {
      text: "Equipment/load stability and potential for unplanned movement has been assessed.",
      risk: PERSONAL,
      guidance: [
        "Equipment, loads and ground surface have been assessed for stability, taking into account:",
        "- load securing",
        "- workplace conditions/travel path",
        "- equipment capacity",
      ],
    },
    {
      text: "Controls/safeguards are in place to prevent impact with workers or objects.",
      risk: PERSONAL,
      guidance: [
        "Mobile equipment is free from hazards prior to movement (e.g. perform a 360° walk around)",
        "- Options to reversing have been assessed prior to reverse operation of equipment",
        "Audible warnings are working on equipment for reverse operations.",
        "The flagger/spotter/ground guide is positioned out of the line of fire and is able to monitor reversing operations.",
        "- Use a clear system of signalling agreed with the operator before starting (e.g., hand signals and/or radio communications and emergency stop signals)",
        "Physical barriers are in place in accordance with the activity plan.",
        "- Define a safe distance from mobile equipment and control access to the area",
        "Note: Before using a flagger/spotter/ground guide, assess the risk they will be exposed to and take precautions to protect them. Only use properly trained personnel or technology alternatives (e.g. cameras/proximity sensors).",
      ],
    },
    {
      text: "Controls are in place to prevent unintentional movement of mobile equipment and/or loads.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "Equipment is located on flat ground where possible",
        "Equipment wheels are chocked when there is potential for movement.",
        "Booms, attachments and accessories are lowered or secured to prevent energy release/movement.",
        "The key is removed when the equipment is not in operation",
      ],
    },
  ],
  "mod-excavation": [
    ENERGY_ISOLATION_FIRST("excavation", "The underground utility has been drained, flushed, or purged to remove explosive materials or gases."),
    {
      text: "Underground utilities are visibly marked (e.g., pipelines, cables, communications, power).",
      risk: PROCESS,
      critical: true,
      guidance: [
        "Local utilities have been consulted about the dig so they can identify their lines",
        "Underground utilities are visibly identified with flagging or paint",
        "Depth and width of utilities or structures are known before digging",
        "Before starting mechanical excavation, actions have been taken to locate and expose underground lines/utilities and structures (e.g., probing, hand digging, soft digging, air knifing, hydro-vac)",
      ],
    },
    {
      text: "Excavation equipment maintains minimum clearances from overhead obstructions.",
      risk: PERSONAL,
      guidance: [
        "The exact location, height and voltage of overhead power lines have been identified.",
        "- Maintain the identified minimum distance between equipment and the energy source",
        "- To help with this, use flagging or barriers on overhead power lines",
      ],
    },
    {
      text: "The excavation area is secured, and barriers are in place to prevent unauthorised access.",
      risk: PERSONAL,
      guidance: [
        "The excavation area is visibly identified with caution tape, silt fencing or other visual identification.",
        "The excavation area is secure from unauthorised access.",
        "No personnel are in line-of-fire hazards (e.g., swing radius of excavator, discharge side of trencher).",
        "Only essential personnel/crew are in the area where the excavation work is occurring.",
      ],
    },
    {
      text: "Soil stability has been assessed and controls/safeguards are in place per the excavation plan.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "A competent person assessed the soil type to define the excavation safeguards.",
        "Excavations have a protective system (sloping, shoring, or shielding) in place as applicable",
        "Excavated material is stored at least 0.61 m (2 ft) from the edge of the excavation",
        "Ensure stability of adjacent utilities/structures potentially affected by the excavation through shoring, bracing and underpinning",
      ],
    },
    {
      text: "Equipment stability and potential for unplanned movement have been assessed.",
      risk: PERSONAL,
      guidance: [
        "Equipment, load and ground surface have been assessed for stability.",
        "Verify:",
        "- load securing",
        "- workplace conditions/travel path",
        "- equipment capacity",
        "Equipment maintains a safe distance from the unprotected edges of excavations or trenches to prevent cave-ins",
      ],
    },
    {
      text: "If personnel enter: the excavation has been evaluated to determine if it is a confined space (N/A if nobody enters the excavation).",
      risk: PERSONAL,
      guidance: [
        "Hold point: items 7–9 apply only if personnel enter the excavation.",
        "The excavation has been evaluated to determine if it is a confined space (trench depths of 1.2 m (4 ft) or more with vertical walls and limited access/egress).",
        "If the excavation is a confined space, follow the company's confined space guidance and local regulations, and complete the Confined Space Entry Start Work Check.",
      ],
    },
    {
      text: "A plan is in place to protect personnel entering the excavation from cave-in, hazardous atmosphere and water accumulation (N/A if nobody enters the excavation).",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "The excavation is inspected by the competent person prior to entry, and as conditions change",
        "Protective systems are in place and may include:",
        "- bracing",
        "- shoring",
        "- underpinning",
        "- benching",
        "Retaining devices or shield systems are in place.",
        "Initial gas testing is conducted by a Qualified Gas Tester",
        "The required follow-up testing frequency is established per the plan",
        "The crew will conduct daily inspections to identify hazards and changing conditions (e.g. contamination, water build-up or utilities encountered).",
      ],
    },
    {
      text: "Excavations deeper than 1.2 m (4 feet) have access and egress (N/A if nobody enters the excavation).",
      risk: PERSONAL,
      guidance: [
        "There is a safe means of access and egress when entering an excavation more than 1.2 m (4 ft) deep, within 6.7 m (25 ft) of lateral travel. Examples:",
        "- ladder",
        "- stairways",
        "- ramps",
        "- sloping for ingress/egress",
      ],
    },
  ],
  "mod-decommissioning": [
    {
      text: "Equipment to be demolished is emptied/cleared of hazardous materials.",
      risk: PROCESS,
      critical: true,
      guidance: ["Hazardous materials include hydrocarbons, chemicals, contaminants, NORM, etc."],
    },
    {
      text: "All energy sources are identified, isolated and marked / colour coded.",
      risk: PROCESS,
      critical: true,
      guidance: ["Energy sources include electrical, pressure, gravity, etc."],
    },
    {
      text: "Equipment that may have stored energy is identified and marked.",
      risk: PROCESS,
      guidance: ["For example: spring-loaded equipment, bent or obstructed materials, valves, pipe, suspensions, loading arms."],
    },
    {
      text: "Safe areas, out of the line of fire, are identified, with barriers in place where practical.",
      risk: PERSONAL,
      guidance: ["Protect against unforeseen equipment and materials movement."],
    },
    {
      text: "The work area is assessed for potential dropped or unsecured objects, and potential objects have been removed or secured.",
      risk: PERSONAL,
      guidance: ["Look for objects that may become loose / unsecured during the demolition process and have the potential to cause harm."],
    },
    {
      text: "Residual contaminants have been identified, and appropriate PPE and work methods provided.",
      risk: "rc-health",
      guidance: ["For example: lead, asbestos, PCBs, etc."],
    },
  ],
  "mod-rig-floor-tubular": [
    {
      text: "The hazards are identified, controlled and it is safe to start.",
      risk: PERSONAL,
      guidance: [
        ...TASK_RISK_ASSESSMENT,
        "Check that the load path is clear of obstructions",
        "Look for equipment (winches, tuggers, third party equipment, etc.) hanging between the rotary and crown in the path of the top drive/power swivel",
        "Consider wind effect on nearby hoses and cables",
        "Log temporary equipment",
        "If applicable, deploy a safety device to prevent the travelling block striking the crown block, and/or check the rig floor has limits and set points in place to prevent block collisions:",
        "- Upper limits set and tested for crown saver (crown out)",
        "- Lower limits set and tested for floor saver (floor out)",
        "- Kick-out set points",
        "- Function tested per company requirements",
        "The dropped object inspection is current. Re-inspect following:",
        "- Excessive vibration or jarring",
        "- A collision or dropped object incident",
        "- Exceeding the maximum working load",
      ],
    },
    {
      text: "Lifting and hoisting equipment is certified, inspected and rated for the task.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "The lifting and hoisting equipment has been inspected per the Original Equipment Manufacturer requirements, including but not limited to:",
        "- Elevators, slips, latches, latch locks, pins, and springs",
        "- Lift nubbins, caps, plugs, slings, bails, shackles, cables, etc.",
        "Equipment has not been altered, modified or field-fabricated",
        "The hoisting equipment (e.g., appliance and lifting accessories) is rated for the lift",
        "Worn or damaged parts are replaced",
      ],
    },
    {
      text: "Elevator inserts have been measured and are the correct size for the tubular.",
      risk: PERSONAL,
      critical: true,
      guidance: ["Elevator inserts have been measured and are the correct size for the tubular and load shoulder being lifted"],
    },
    {
      text: "The method used to latch/secure the elevators is understood by the work crew.",
      risk: PERSONAL,
      guidance: [
        "The work crew understands:",
        "- The method/mechanism used to latch/secure the elevator (manual or hydraulic)",
        "- The importance of checking the latching/securing each time the elevators are engaged",
      ],
    },
    {
      text: "Lift nubbins, caps & plugs are the correct size and fully threaded.",
      risk: PERSONAL,
      guidance: [
        "Lift nubbins, caps & plugs should:",
        "- match the threads of the tubular(s) being lifted",
        "- be marked to indicate size",
        "- be certified for lifting (i.e., not a thread protector)",
        "The work crew understands lift nubbins, caps & plugs should be fully threaded and tightened",
      ],
    },
    {
      text: "A communication plan and responsibilities are agreed by the work crew.",
      risk: PERSONAL,
      guidance: [
        "Primary and secondary communication methods (e.g., radios, agreed hand signals) have been tested",
        "Emergency stop signals that will be used are agreed",
        "The person in charge has been identified as per the plan or procedure",
        "The members of the work crew have agreed to their individual roles and responsibilities",
      ],
    },
    {
      text: "Restricted zones are identified, and access is controlled based on activity.",
      risk: PERSONAL,
      guidance: [
        "Restricted zones have been identified and controls are in place to protect people from line of fire hazards",
        "Access to restricted zones is controlled",
        "Safe zones have been identified and escape routes are unobstructed and known by the work crew",
      ],
    },
  ],
  "mod-driving": [
    {
      text: "A plan is in place to manage the journey hazards.",
      risk: PERSONAL,
      guidance: [
        "The Journey Management Plan includes, and the driver is aware of:",
        "- the destination",
        "- the route to be taken",
        "- local traffic",
        "- weather and road conditions",
        "- designated emergency contacts",
        "The driver is authorised and has the applicable licence to operate the vehicle type in the area.",
        "The driver has allocated time in the journey schedule for rest breaks.",
        "If the vehicle has a monitoring system, it is activated during the journey.",
      ],
    },
    {
      text: "The driver is fit, rested and fully alert.",
      risk: PERSONAL,
      critical: true,
      guidance: [
        "The driver is:",
        "- well-rested",
        "- fit to undertake the journey",
        "- not under the influence of drugs, alcohol or medications that may impair the ability to drive",
        "Controls are in place to manage personal fatigue, including:",
        "- maximum drive times",
        "- minimum hours of rest prior to driving",
        "- if applicable, rest breaks during the journey",
      ],
    },
    {
      text: "The driver is familiar with local road and driving regulations.",
      risk: PERSONAL,
      guidance: ["The driver is familiar with speed limits, local signage and general communications (e.g., radio usage if applicable and channels)."],
    },
    {
      text: "The driver is aware of anticipated road hazards and weather conditions.",
      risk: PERSONAL,
      guidance: [
        "The driver has checked weather forecasts, local traffic and the driving environment (e.g., ice, snow, rain, flooding) and confirmed road conditions (e.g., pavement, gravel, road construction).",
      ],
    },
    {
      text: "A pre-trip walk-around inspection has been completed to confirm the selected vehicle is fit for the journey.",
      risk: PERSONAL,
      guidance: [
        "The pre-trip inspection is complete prior to vehicle use.",
        "The vehicle is:",
        "- in good working order",
        "- specific for the journey",
        "- equipped for anticipated weather, road conditions and emergencies",
        "Perform a 360° walk around to ensure the vehicle is free from hazards prior to movement.",
      ],
    },
    {
      text: "The objects inside and outside the vehicle have been secured prior to the trip.",
      risk: PERSONAL,
      guidance: [
        "Safety or restraint systems are in place and capable of securing the load.",
        "Tools, equipment and other loose objects are removed or secured both inside and outside the vehicle (e.g. tool-boxes, cargo nets)",
        "If applicable, a load securement checklist is completed",
      ],
    },
    {
      text: "All vehicle occupants are using their seatbelts.",
      risk: PERSONAL,
      critical: true,
      guidance: ["Seatbelts are in good working order and are being worn properly (e.g., three-point restraint)."],
    },
    {
      text: "A plan is in place to eliminate or minimise distractions while driving.",
      risk: PERSONAL,
      guidance: [
        "The driver will not interact with a phone or operate a device while driving.",
        "- Incoming calls are diverted while driving.",
        "- The driver will stop in a safe area to use any phone or mobile device",
        "Digital mapping devices (e.g., GPS/directional guidance) are programmed prior to the journey.",
      ],
    },
  ],
};
