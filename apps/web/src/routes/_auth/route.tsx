import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { sessionQuery } from "@/lib/session-query";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
    return { session };
  },
});

function AuthLayout() {
  return <Outlet />;
}
