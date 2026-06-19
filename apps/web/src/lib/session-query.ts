import { queryOptions } from "@tanstack/react-query";

import { authClient } from "./auth-client";

export const sessionQueryKey = ["session"] as const;

export const sessionQuery = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async () => {
    const { data, error } = await authClient.getSession();
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000,
});

export async function invalidateSession() {
  const { queryClient } = await import("./query-client");
  await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
}
