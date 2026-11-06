// MOCK: demo users. All names, companies and emails are fictional. Every demo password is "demo1234".

import type { User } from "@/lib/types";

export const DEMO_PASSWORD = "demo1234";

const createdAt = "2026-05-04T08:00:00.000Z";

const user = (u: Omit<User, "password" | "createdAt" | "status"> & Partial<Pick<User, "status" | "createdAt">>): User => ({
  password: DEMO_PASSWORD,
  status: "ACTIVE",
  createdAt,
  ...u,
});

export const USERS: User[] = [
  user({
    id: "usr-admin",
    name: "Ngozi Adeyemi",
    email: "admin@example.com",
    company: "Project Marine Team",
    position: "Vessel SIMOPS Manager",
    role: "ADMIN",
  }),
  user({
    id: "usr-sup-tunde",
    name: "Tunde Bakare",
    email: "tunde.bakare@example.com",
    company: "Project Marine Team",
    position: "Marine Representative",
    role: "SUPERVISOR",
  }),
  user({
    id: "usr-sup-chidi",
    name: "Chidi Eze",
    email: "chidi.eze@example.com",
    company: "Harbourline Offshore Services",
    position: "Team Lead",
    role: "SUPERVISOR",
  }),
  user({
    id: "usr-wkr-ibrahim",
    name: "Ibrahim Musa",
    email: "ibrahim.musa@example.com",
    company: "Harbourline Offshore Services",
    position: "Master",
    role: "WORKER",
  }),
  user({
    id: "usr-wkr-blessing",
    name: "Blessing Okon",
    email: "blessing.okon@example.com",
    company: "Coastway Marine",
    position: "Bridge Officer",
    role: "WORKER",
  }),
  user({
    id: "usr-wkr-emeka",
    name: "Emeka Nwosu",
    email: "emeka.nwosu@example.com",
    company: "Coastway Marine",
    position: "Chief Engineer",
    role: "WORKER",
  }),
  user({
    id: "usr-wkr-funmi",
    name: "Funmi Alade",
    email: "funmi.alade@example.com",
    company: "Deltaport Crewing",
    position: "Galley Team",
    role: "WORKER",
  }),
  // Stage 12: more crews and supervisors, so the dashboard has contractors to rank.
  user({ id: "usr-sup-amina", name: "Amina Lawal", email: "amina.lawal@example.com", company: "Project Marine Team", position: "Offshore Coordinator", role: "SUPERVISOR" }),
  user({ id: "usr-sup-segun", name: "Segun Ogunleye", email: "segun.ogunleye@example.com", company: "Bluewake Vessel Management", position: "Manager/MFE Visitor", role: "SUPERVISOR" }),
  user({ id: "usr-sup-ruth", name: "Ruth Ekanem", email: "ruth.ekanem@example.com", company: "Riverbend Marine Logistics", position: "Team Lead", role: "SUPERVISOR" }),
  user({ id: "usr-wkr-aisha", name: "Aisha Bello", email: "aisha.bello@example.com", company: "Bluewake Vessel Management", position: "Crew Member", role: "WORKER" }),
  user({ id: "usr-wkr-david", name: "David Okafor", email: "david.okafor@example.com", company: "Bluewake Vessel Management", position: "Bridge Officer", role: "WORKER" }),
  user({ id: "usr-wkr-grace", name: "Grace Effiong", email: "grace.effiong@example.com", company: "Riverbend Marine Logistics", position: "Master", role: "WORKER" }),
  user({ id: "usr-wkr-yusuf", name: "Yusuf Danjuma", email: "yusuf.danjuma@example.com", company: "Riverbend Marine Logistics", position: "Chief Engineer", role: "WORKER" }),
  user({ id: "usr-wkr-ifeoma", name: "Ifeoma Nnaji", email: "ifeoma.nnaji@example.com", company: "Seacrest Catering Services", position: "Galley Team", role: "WORKER" }),
  user({ id: "usr-wkr-tobi", name: "Tobi Adebayo", email: "tobi.adebayo@example.com", company: "Deltaport Crewing", position: "Crew Member", role: "WORKER" }),
  user({ id: "usr-wkr-esther", name: "Esther Udo", email: "esther.udo@example.com", company: "Harbourline Offshore Services", position: "Bridge Officer", role: "WORKER" }),
  user({
    id: "usr-pending-samuel",
    name: "Samuel Etim",
    email: "samuel.etim@example.com",
    company: "Deltaport Crewing",
    position: "Crew Member",
    role: "WORKER",
    status: "PENDING",
    createdAt: "2026-11-03T14:20:00.000Z",
  }),
  user({
    id: "usr-disabled-kunle",
    name: "Kunle Ojo",
    email: "kunle.ojo@example.com",
    company: "Harbourline Offshore Services",
    position: "Crew Member",
    role: "WORKER",
    status: "DISABLED",
  }),
];
