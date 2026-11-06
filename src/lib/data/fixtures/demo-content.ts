// MOCK: wording for the generated demo history (comments, tasks, actions, photo subjects). Fictional but written
// the way crews and marine reps actually write on board. Production: remove with the history (CLAUDE.md §14).

interface ModuleContent {
  /** Comments on a No answer. */
  no: string[];
  /** Comments on a Concern Identified answer. */
  concern: string[];
  /** Good Practice observations (become positive interventions). */
  good: string[];
  /** What a demo evidence photo shows. */
  photos: string[];
}

export const MODULE_CONTENT: Record<string, ModuleContent> = {
  "mod-marine-start-work": {
    no: [
      "Permit on the board was for yesterday's lift; new permit not yet signed by the OIM.",
      "Sling certificate for the 10 t shackle could not be found on board.",
      "Toolbox talk skipped - crew went straight to the crane after the crew change.",
      "Supply boat alongside on the other side; SIMOPS not discussed with the bridge.",
      "Banksman not identified before the lift started.",
    ],
    concern: [
      "Risk assessment reviewed, but two new crew members had not signed it.",
      "Radio check done on channel 12 only; backup channel not agreed.",
      "PPE fine but one glove pair worn through - replaced on the spot.",
    ],
    good: [
      "Bosun ran a clear toolbox talk and asked each person to repeat their role.",
      "Deck crew paused the lift when wind gusted over 30 kn - good use of Stop Work.",
    ],
    photos: ["Permit board", "Lifting sling tag", "Toolbox talk sheet"],
  },
  "mod-bridge-team": {
    no: [
      "Port radar intermittent since Tuesday; defect not entered in the log.",
      "Safety Management Certificate expired 3 weeks ago - renewal email only.",
      "Only one officer on the bridge during DP operations at the installation.",
    ],
    concern: [
      "Standing orders signed by the outgoing Master, not yet by the relief.",
      "UHF handset battery weak; spare charging.",
      "Defect list up to date but two items have no target date.",
    ],
    good: ["Bridge team held a short DP briefing before entering the 500 m zone.", "Defect log neatly kept with photos of each repair."],
    photos: ["Bridge defect log", "Certificate folder", "Radar display"],
  },
  "mod-navigation-watch": {
    no: [
      "AIS not transmitting; vessel not visible on the installation's screen.",
      "No passage plan for the Forcados run - only a chart track.",
      "Watch handover done verbally, nothing written in the log.",
    ],
    concern: [
      "Weather forecast printed at 06:00, not updated for the afternoon squall.",
      "500 m zone checklist completed but not signed by the OOW.",
    ],
    good: ["OOW called the installation early when visibility dropped - textbook.", "Passage plan briefed to the whole watch with tidal windows marked."],
    photos: ["Passage plan", "ECDIS screen", "Weather printout"],
  },
  "mod-personnel-transfer": {
    no: [
      "Two passengers on the basket without lifejackets.",
      "Swell over 2.5 m - above the limit in the transfer procedure, transfer went ahead.",
      "No passenger brief before the crew boat transfer.",
    ],
    concern: ["Gangway approved, but the motion log was not checked before use.", "Brief done, but in English only; two visitors unsure."],
    good: ["Crew boat coxswain refused transfer at 2.4 m swell and waited for the window.", "Clear passenger brief with a head count at both ends."],
    photos: ["Personnel basket", "Lifejacket rack", "Transfer log"],
  },
  "mod-cargo-operations": {
    no: [
      "Two cargo baskets with expired inspection tags (due June).",
      "Deck plan on the bridge did not match the containers on deck.",
      "Lashings missing on the 20 ft container aft.",
    ],
    concern: ["Safe havens known, but the starboard one was blocked by drums.", "Container certificates on file, one tag hard to read."],
    good: ["Deck crew colour-coded tag lines and safe havens - very clear.", "Cargo manifest checked item by item with the crane operator."],
    photos: ["Cargo basket tag", "Deck cargo lashings", "Deck plan"],
  },
  "mod-bunkering": {
    no: [
      "Bunker hose test certificate expired in August.",
      "Scuppers on the port side not plugged during transfer.",
      "Bunkering checklist not completed with the receiving unit.",
    ],
    concern: ["Spill kit on deck, but missing absorbent pads.", "Hose inspected, coupling seal worn - monitor."],
    good: ["Bunkering checklist read aloud on the radio with the rig - excellent.", "Drip trays in place under every coupling, all scuppers plugged."],
    photos: ["Bunker hose coupling", "Spill kit", "Scupper plug"],
  },
  "mod-security": {
    no: [
      "Gangway unattended for 20 minutes during the meal break.",
      "Visitor register last filled in two days ago.",
      "Steering gear room door left unlocked.",
    ],
    concern: ["Security drill done but not recorded in the log.", "MARSEC level posted on the bridge, not in the mess."],
    good: ["Gangway watch checked every ID and called the bridge for an unexpected visitor."],
    photos: ["Visitor register", "Gangway access point", "Restricted area door"],
  },
  "mod-occupational-health": {
    no: [
      "Potable water test overdue - last sample in July.",
      "Three crew over the work-rest limits during the anchor handling campaign.",
      "Ear defenders not available at the engine room entrance.",
    ],
    concern: ["Medical locker stocked, two items expire this month.", "Work-rest hours recorded, but not reviewed by the Master."],
    good: ["Chief Engineer rotated engine room watches to keep everyone within rest hours."],
    photos: ["Water test kit", "Medical locker", "Rest hours record"],
  },
  "mod-galley": {
    no: [
      "Cold room at 9 °C; temperature log not filled in since Saturday.",
      "Raw chicken stored above vegetables in the chiller.",
      "Extraction hood filter heavily greased.",
    ],
    concern: ["Food-handling certificate for the new cook not yet on file.", "Fire blanket present but packaging damaged."],
    good: ["Galley spotless, temperature logs complete and colour-coded boards in use.", "Cook labels every container with the date it was opened."],
    photos: ["Cold room thermometer", "Galley extraction hood", "Food storage shelves"],
  },
  "mod-working-at-height": {
    no: [
      "Harness inspection tag missing; last check date unknown.",
      "No rescue plan written for the mast work.",
      "Tools not tethered; area below not barriered.",
    ],
    concern: ["Permit in place, but rescue kit stored on the other deck.", "Lanyard shows minor abrasion - replaced after the job."],
    good: ["Exclusion zone barriered and a dedicated watchman below the mast."],
    photos: ["Harness inspection tag", "Barriered drop zone", "Tool lanyards"],
  },
  "mod-confined-space-entry": {
    no: [
      "Gas test reading recorded at 07:00; no retest after the lunch break.",
      "Standby person also tasked with deck work - not at the hatch.",
      "Tank isolations not shown on the permit.",
    ],
    concern: ["Rescue tripod rigged but not tested before entry.", "Gas detector bump test done, calibration due next week."],
    good: ["Standby person kept a written log of everyone in and out of the tank."],
    photos: ["Gas detector reading", "Tank entry hatch", "Entry log"],
  },
  "mod-hot-work": {
    no: [
      "Gas test record missing for the 14:00 retest.",
      "Fire watch left the area before the 30-minute cool-down.",
      "Hot work permit not displayed at the job site.",
    ],
    concern: ["Combustibles moved, but a paint locker is 5 m away.", "Extinguisher ready; hose not run out."],
    good: ["Welder stopped work when a fuel transfer started nearby and called the bridge."],
    photos: ["Gas test meter", "Fire watch station", "Hot work permit"],
  },
  "mod-energy-isolation": {
    no: [
      "Breaker isolated but no personal lock fitted.",
      "Zero-energy test not done before opening the hydraulic line.",
      "Isolation list on the permit did not include the accumulator.",
    ],
    concern: ["Locks fitted, one tag unreadable after rain.", "Isolation recorded, but signed by one person only."],
    good: ["Electrician demonstrated try-out on every isolation point to the team."],
    photos: ["Lock-out board", "Isolation tag", "Hydraulic accumulator"],
  },
  "mod-emergency-preparedness": {
    no: [
      "Rescue boat engine test not logged since the last crew change.",
      "Two lifejacket lights not working in the port muster station.",
      "Abandon ship drill overdue by 3 weeks.",
    ],
    concern: ["Muster list updated, but two new crew not yet briefed on duties.", "Emergency response plan current; bridging document is the old revision."],
    good: ["Unannounced fire drill, everyone mustered in under 4 minutes, good debrief.", "Master walked new crew to their muster station on day one."],
    photos: ["Muster station board", "Lifejacket light", "Rescue boat"],
  },
  "mod-leadership-engagement": {
    no: ["No leadership visit recorded this month.", "Two crew could not explain how to use Stop Work Authority."],
    concern: ["Toolbox talks happen but are mostly read from a sheet.", "Learning from the dropped-object incident not shared with the night shift."],
    good: [
      "Master shared the latest incident learning at the morning meeting and asked for questions.",
      "Young AB stopped a lift when the tag line snagged; Master thanked him in front of the crew.",
    ],
    photos: ["Learning board", "Toolbox talk session"],
  },
  "mod-contractor-management": {
    no: ["Two contractor welders on board without a site induction.", "Contractor scaffolders working outside the vessel permit system."],
    concern: ["Competence records verified, one certificate is a photocopy.", "Contractor supervisor's number not posted on the board."],
    good: ["Contractor team joined the vessel toolbox talk and shared their own risk assessment."],
    photos: ["Induction records", "Contractor competence file"],
  },
  "mod-learning-action-closure": {
    no: ["Four findings from the last MFE still open with no evidence.", "Near miss cards not available on deck."],
    concern: ["Actions closed, but evidence is a verbal confirmation only.", "Overdue actions known to the Master, not escalated."],
    good: ["Action tracker printed on the mess notice board with owners and due dates."],
    photos: ["Action tracker board", "Near miss card box"],
  },
};

/** Short notes on some compliant answers. */
export const YES_NOTES = [
  "Checked on deck, all good.",
  "Verified with the Chief Officer.",
  "Seen and confirmed during the walkround.",
  "Records checked and in order.",
  "Confirmed with the crew on shift.",
];

/** Start Work Check job descriptions per Start Work module. */
export const TASKS: Record<string, string[]> = {
  "mod-marine-start-work": [
    "Backload of empty baskets to the supply vessel",
    "Mooring operations at the buoy",
    "Anchor handling preparation on the aft deck",
    "Deck crane lift of food containers",
  ],
  "mod-working-at-height": ["Replace navigation light on the mast", "Inspect antenna on the monkey island", "Paint the funnel", "Clean bridge windows from the cradle"],
  "mod-confined-space-entry": ["Inspect ballast tank 3 port", "Clean fuel oil day tank", "Survey void space aft", "Repair sewage tank level sensor"],
  "mod-hot-work": ["Weld new bracket on the aft deck", "Cut and replace deck plating", "Repair handrail by welding", "Weld crack on the A-frame base"],
  "mod-energy-isolation": [
    "Replace hydraulic hose on deck crane 2",
    "Overhaul main engine cooling pump",
    "Change breaker in the main switchboard",
    "Service the anchor winch brake",
  ],
};

/** Follow-up actions besides A1 (which repeats the finding). */
export const ACTION_TEXT = [
  "Correct on board and send photo evidence to the Marine Representative.",
  "Brief all crew at the next toolbox talk and record attendance.",
  "Replace or recertify the equipment and file the new certificate.",
  "Update the procedure and re-brief both watches.",
  "Raise with the contractor and confirm close-out in writing.",
];

export const CLOSURE_COMMENTS = [
  "Replaced on board; photo sent to the Marine Representative.",
  "Crew re-briefed at the 07:00 toolbox talk; attendance sheet filed.",
  "New certificate received from the contractor; copy kept on board.",
  "Verified on board by the Marine Representative.",
  "Procedure updated and briefed to both watches.",
  "Checked again at the next MFE: in place and working.",
];

export const GENERAL_FINDINGS = [
  "Housekeeping on the aft deck needs attention: loose ropes and drums near the walkway.",
  "Several crew unsure where the latest bridging document is kept.",
  "Notice boards out of date: last month's learning still posted.",
];
