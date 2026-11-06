"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { errorMessage } from "@/lib/errors";
import type { PublicUser } from "@/lib/types";

interface AdminActionOptions<TVariables, TResult> {
  /** Toast shown on success. */
  success: (result: TResult, variables: TVariables) => string;
  /** Query keys (or prefixes) to refresh after success. */
  invalidates: QueryKey[];
  onSuccess?: (result: TResult, variables: TVariables) => void;
}

/**
 * Runs an admin service function as the signed-in user, refreshes the affected lists
 * and reports the outcome with a toast. `mutateAsync` rethrows so forms can show field errors.
 */
export function useAdminAction<TVariables, TResult>(
  action: (actor: PublicUser, variables: TVariables) => Promise<TResult>,
  options: AdminActionOptions<TVariables, TResult>,
) {
  const actor = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TVariables) => action(actor, variables),
    onSuccess: async (result, variables) => {
      await Promise.all(options.invalidates.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      toast.success(options.success(result, variables));
      options.onSuccess?.(result, variables);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });
}
