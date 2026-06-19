import { type QueryClient, queryOptions } from "@tanstack/react-query";

import { authClient } from "./auth-client";
import { queryClient } from "./query-client";

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

export function fetchCurrentSession(client: QueryClient) {
  return client.fetchQuery({
    ...sessionQuery,
    staleTime: 0,
  });
}

export async function refreshSession() {
  const { data, error } = await authClient.getSession();
  if (error) throw error;

  queryClient.setQueryData(sessionQueryKey, data);
  return data;
}

export function clearSession() {
  queryClient.setQueryData(sessionQueryKey, null);
}
