// MOCK: the Fleet Vessel Register from the design document (CLAUDE.md §18).
// Locations are not in the register, so each vessel gets a random demo location from a fixed seed:
// "random", but identical after every reset.

import type { Vessel } from "@/lib/types";
import { LOCATIONS } from "./lookups";

const REGISTER: [name: string, packageId: string, vesselTypeId: string][] = [
  ["FDS", "pkg-epc2", "vt-installation"],
  ["Shen Da Hao", "pkg-epc2", "vt-installation"],
  ["Normand Sentinel", "pkg-epc2", "vt-installation"],
  ["Greenbarge 2", "pkg-epc2", "vt-cargo-barge"],
  ["Dark Knight II", "pkg-epc2", "vt-ahts"],
  ["BOA44", "pkg-epc2", "vt-cargo-barge"],
  ["Topaz Master", "pkg-epc2", "vt-ahts"],
  ["Greenbarge 4", "pkg-epc2", "vt-cargo-barge"],
  ["BL216", "pkg-epc2", "vt-ahts"],
  ["JMC3337", "pkg-epc2", "vt-cargo-barge"],
  ["Astro Sculptor", "pkg-epc2", "vt-ahts"],
  ["Greenbarge 1", "pkg-epc2", "vt-cargo-barge"],
  ["BL222", "pkg-epc2", "vt-ahts"],
  ["AHTS Aspire", "pkg-epc2", "vt-ahts"],
  ["Lady Perpetual", "pkg-epc2", "vt-psv"],
  ["Neptun Express", "pkg-epc2", "vt-psv"],
  ["Astro Rasalas", "pkg-epc2", "vt-psv"],
  ["Surfer 2624", "pkg-epc2", "vt-crew-boat"],
  ["Surfer 1903", "pkg-epc2", "vt-crew-boat"],
  ["MV Pistos (FSIV)", "pkg-epc2", "vt-crew-boat"],
  ["Lady Oge", "pkg-epc2", "vt-sev"],
  ["Armed Responder XV", "pkg-epc2", "vt-sev"],
  ["Anne 3", "pkg-epc2", "vt-sev"],
  ["Queen Jay", "pkg-epc2", "vt-sev"],
  ["Otunba Legacy", "pkg-epc2", "vt-sev"],
  ["DPMS Conqueror", "pkg-epc2", "vt-sev"],
  ["Blue Gretha", "pkg-epc1", "vt-flotel"],
  ["IGM Amethyst", "pkg-epc1", "vt-psv"],
  ["Eastern Ursinia", "pkg-epc1", "vt-psv"],
  ["Nue Domingas", "pkg-epc1", "vt-crew-boat"],
  ["Nue Strider", "pkg-epc1", "vt-sev"],
  ["SVS Guardsman", "pkg-epc1", "vt-sev"],
  ["BLOEMGRACHT", "pkg-epc1", "vt-hlv"],
  ["Safeen Argus 2", "pkg-wells", "vt-psv"],
  ["MV Oshibugie", "pkg-wells", "vt-psv"],
  ["A60", "pkg-wells", "vt-psv"],
  ["ACE Discoverer", "pkg-wells", "vt-psv"],
  ["DS10", "pkg-wells", "vt-installation"],
  ["MV Bemigho", "pkg-wells", "vt-psv"],
  ["African Vision", "pkg-company-epc3", "vt-installation"],
  ["NUE FERULLA", "pkg-epc1", "vt-sev"],
];

/** Small deterministic PRNG (mulberry32). */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const random = seededRandom(20261105);

export const VESSELS: Vessel[] = REGISTER.map(([name, packageId, vesselTypeId]) => ({
  id: `ves-${slug(name)}`,
  name,
  vesselTypeId,
  packageId,
  contractor: null,
  defaultLocationId: LOCATIONS[Math.floor(random() * LOCATIONS.length)].id,
  status: "ACTIVE",
}));
