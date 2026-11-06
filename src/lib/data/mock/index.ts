// MOCK: the complete mock implementation of the repository contracts.

import type { Repositories } from "@/lib/data/repositories";
import { auth, logInAs } from "./auth";
import { assessments, responses } from "./assessment-repositories";
import {
  actions,
  findingActivities,
  findingDrafts,
  findings,
  notifications,
  positiveInterventions,
} from "./finding-repositories";
import { clearPhotos, getPhotoMeta, getPhotoUrl, removePhoto, savePhoto } from "./photo-store";
import {
  auditTypes,
  locations,
  modules,
  packages,
  questions,
  riskCategories,
  users,
  vessels,
  vesselTypes,
} from "./reference-repositories";
import { resetStore } from "./store";
import { simulateLatency } from "./utils";

export const mockRepositories: Repositories = {
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
  // MOCK: IndexedDB photo storage; production uses cloud object storage behind the same interface.
  photos: {
    async upload(blob, dimensions) {
      await simulateLatency();
      return savePhoto(blob, dimensions);
    },
    async getUrl(id) {
      return getPhotoUrl(id);
    },
    async getMeta(id) {
      return getPhotoMeta(id);
    },
    async delete(id) {
      await simulateLatency();
      return removePhoto(id);
    },
  },
  demo: {
    async reset() {
      await simulateLatency();
      resetStore();
      await clearPhotos();
    },
    logInAs,
  },
};
