import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { fetchCurrentSession } from "@/lib/session-query";

export const Route = createFileRoute("/_staff")({
  component: StaffLayout,
  beforeLoad: async ({ context }) => {
    const session = await fetchCurrentSession(context.queryClient);

    if (!session) {
      throw redirect({
        to: "/login",
      });
    }

    if (session.user.role !== "staff") {
      throw redirect({
        to: "/dashboard",
      });
    }

    return { session };
  },
});

function StaffLayout() {
  return <Outlet />;
}
