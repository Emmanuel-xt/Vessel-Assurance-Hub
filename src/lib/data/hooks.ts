"use client";

// Hooks every page uses to read and write data, so loading, error and refresh behaviour is identical everywhere.
//
// Query key convention: the first element is the repository name, e.g. ["vessels", filter] or ["findings", id].
// A mutation that `invalidates: [["vessels"]]` then refreshes every vessel query on screen.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { resetDemoDataAs } from "@/lib/services/admin/demo";
import type { Principal } from "@/lib/services/permissions";

export function useRepoQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryKey" | "queryFn">,
) {
  return useQuery({ queryKey, queryFn, ...options });
}

export interface RepoMutationOptions<TVariables, TResult> {
  /** Query keys (or key prefixes) to refresh after success. */
  invalidates?: QueryKey[];
  onSuccess?: (result: TResult, variables: TVariables) => void;
}

export function useRepoMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  options: RepoMutationOptions<TVariables, TResult> = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result, variables) => {
      await Promise.all((options.invalidates ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      options.onSuccess?.(result, variables);
    },
  });
}

/** MOCK: restores the demo fixtures (admins only, checked in the service) and refreshes every query on screen. */
export function useResetDemoData(actor: Principal) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetDemoDataAs(actor),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
