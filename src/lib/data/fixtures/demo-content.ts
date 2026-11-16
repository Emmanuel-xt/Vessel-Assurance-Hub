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
  "mod-deck-work": {
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
      "No passage plan for the Onne run - only a chart track.",
      "Watch handover done verbally, nothing written in the log.",
    ],
    concern: [
      "Weather forecast printed at 06:00, not updated for the afternoon squall.",
      "500 m zone checklist completed but not signed by the OOW.",
    ],
    good: ["OOW called the installation early when visibility dropped - textbook.", "Passage plan briefed to the whole watch with tidal windows marked."],
    photos: ["Passage plan", "ECDIS screen", "Weather printout"],
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
  "mod-bunkering": {
    no: [
      "Hose test certificate expired in August; hose still rigged for the transfer.",
      "Port side scuppers not plugged before pumping started.",
      "Pre-transfer meeting skipped - receiving unit not told the agreed rate.",
    ],
    concern: ["Spill kit on deck, but short of absorbent pads."],
    good: ["Bunkering checklist read aloud on the radio with the installation - excellent."],
    photos: ["Bunker hose coupling", "Spill kit", "Scupper plug"],
  },
  "mod-personnel-transfer": {
    no: [
      "Two passengers in the basket without lifejackets.",
      "Swell above the transfer limit; transfer still started.",
      "Receiving deck not told the basket was coming.",
    ],
    concern: ["Brief given in English only; two visitors unsure of the signals."],
    good: ["Coxswain held the transfer for the weather window and briefed everyone again."],
    photos: ["Personnel basket", "Lifejacket rack", "Transfer briefing card"],
  },
  "mod-mechanical-lifting": {
    no: [
      "Load chart for the deck crane not in the cab.",
      "Sling certificate could not be found for the 10 t shackle.",
      "Exclusion zone not barriered; deckhand walked under the load.",
    ],
    concern: ["Tagline rigged, but the signaller was not named in the lift plan."],
    good: ["Banksman stopped the lift when the wind picked up and re-briefed the crew."],
    photos: ["Crane load chart", "Lifting sling tag", "Barriered lift zone"],
  },
  "mod-de-isolation": {
    no: ["Isolation removed before the job card was signed off.", "Engine room not told the pump was being re-energised."],
    concern: ["Vent left open after the line was returned to service."],
    good: ["Team walked the isolation list point by point before removing locks."],
    photos: ["Isolation list", "Lock-out board", "Valve tag"],
  },
  "mod-energised-electrical": {
    no: [
      "Arc flash suit not available for the switchboard work.",
      "No electrical standby person at the panel.",
      "Insulated tools past their test date.",
    ],
    concern: ["Rubber mat in place, but torn at one corner."],
    good: ["Electrician tested the voltage detector on a known source before and after the job."],
    photos: ["Switchboard barrier", "Insulated tools", "Arc flash PPE"],
  },
  "mod-man-riding": {
    no: ["Winch not marked as suitable for man-riding.", "Rescue plan not discussed before the rider went up."],
    concern: ["Radio check done, hand signals not agreed with the winch operator."],
    good: ["Spotter kept the rider in sight for the whole lift and called every stop."],
    photos: ["Man-riding winch", "Rider harness", "Exclusion zone"],
  },
  "mod-work-near-water": {
    no: ["Deckhand at the open stern without a lifejacket.", "Rescue boat crew not told about the overside work."],
    concern: ["Life ring in place, but its line was tangled."],
    good: ["Stern gate area roped off and a dedicated watch posted with a life ring."],
    photos: ["Lifejacket", "Life ring station", "Roped-off stern"],
  },
  "mod-mobile-equipment": {
    no: ["Forklift reversing alarm not working.", "No marked walkway through the laydown area."],
    concern: ["Wheel chocks available but not used on the slope."],
    good: ["Banksman walked ahead of the forklift through the whole quayside move."],
    photos: ["Forklift reversing alarm", "Pedestrian walkway", "Wheel chocks"],
  },
  "mod-excavation": {
    no: ["Cable route drawing not checked before digging.", "Spoil heaped at the trench edge."],
    concern: ["Barrier tape up, but one side open to the road."],
    good: ["Team hand-dug to expose the cable before using the excavator."],
    photos: ["Marked utilities", "Trench shoring", "Barriered excavation"],
  },
  "mod-decommissioning": {
    no: ["Line not flushed before cutting.", "Stored energy in the spring hanger not marked."],
    concern: ["Asbestos survey done, results not shared with the crew."],
    good: ["Every isolation colour-coded and checked by two people before cutting started."],
    photos: ["Colour-coded isolation", "Cleared equipment", "Dropped-object check"],
  },
  "mod-rig-floor-tubular": {
    no: ["Elevator inserts not measured against the tubular.", "Lift nubbin not certified for lifting."],
    concern: ["Crown saver tested, floor saver test not recorded."],
    good: ["Driller checked the latch every time the elevators closed."],
    photos: ["Elevator inserts", "Lift nubbin", "Restricted zone"],
  },
  "mod-driving": {
    no: ["No journey plan for the trip to the base.", "Rear passenger not wearing a seatbelt."],
    concern: ["Vehicle checked, spare tyre soft."],
    good: ["Driver pulled over to take the call instead of answering while driving."],
    photos: ["Vehicle checklist", "Seatbelt", "Journey plan"],
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
  "mod-bunkering": ["Receive MGO from the supply vessel", "Transfer fuel to the installation", "Take on fresh water alongside"],
  "mod-personnel-transfer": ["Crew change by basket to the installation", "Gangway transfer to the FPSO", "Crew boat transfer of visitors"],
  "mod-mechanical-lifting": ["Backload of empty baskets", "Lift food containers with the deck crane", "Offload drill pipe from the deck"],
  "mod-de-isolation": ["Return cooling pump to service", "Re-energise deck crane 2 after repair"],
  "mod-energised-electrical": ["Fault-find on the live lighting panel", "Test the shore power connection"],
  "mod-man-riding": ["Inspect the crane boom head by man-riding winch", "Replace sheave at the A-frame top"],
  "mod-work-near-water": ["Overside hull inspection from the stern", "Retrieve debris from the water at the stern"],
  "mod-mobile-equipment": ["Forklift moves on the quayside laydown", "Load trucks at the supply base"],
  "mod-excavation": ["Dig cable trench at the supply base"],
  "mod-decommissioning": ["Remove redundant pipework on the aft deck"],
  "mod-rig-floor-tubular": ["Run casing on the rig floor"],
  "mod-driving": ["Drive crew to the supply base"],
  "mod-deck-work": [
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

/** How auditors close a Start Work Check once the job is cleared. */
export const ACTIVITY_CLOSURES = [
  "All checks in, toolbox talk done. Cleared to start.",
  "Team briefed at the worksite; permit signed. Job started.",
  "Checks reviewed with the supervisor; one No resolved before work began.",
  "Everyone signed on. Area barriered, standby man in place.",
  "Job complete and area handed back. Closing the check.",
];
