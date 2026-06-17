import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_staff")({
  component: StaffLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();

    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    if (session.data.user.role !== "staff") {
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
