// THE switch: the single place that chooses which data implementation the app uses.
// Pages, components and services import from "@/lib/data" only, never from ./mock directly.
// To plug in a real backend, replace the implementation on the marked line. Nothing else changes.

import { mockRepositories } from "./mock"; // MOCK
import type { Repositories } from "./repositories";

export const repositories: Repositories = mockRepositories; // ← change this line for a real backend

export const {
  auth,
  users,
  locations,
  packages,
  vesselTypes,
  riskCategories,
  auditTypes,
  vessels,
  modules,
  questions,
  assessments,
  responses,
  findings,
  actions,
  findingActivities,
  findingDrafts,
  positiveInterventions,
  notifications,
  photos,
} = repositories;

/** MOCK: restores the demo fixtures and deletes stored photos ("Reset demo data" button). */
export const resetDemoData = (): Promise<void> => repositories.demo.reset();

/** MOCK: passwordless sign-in for demo quick-login and "Demo as". */
export const demoLogInAs = (userId: string) => repositories.demo.logInAs(userId);

export * from "./repositories";
