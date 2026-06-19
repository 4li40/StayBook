import { Link } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

import UserMenu from "./user-menu";

export default function Header() {
  const { data: session } = authClient.useSession();
  const role = session?.user.role;
  const links = [
    { to: "/rooms", label: "Find a room" },
    ...(role === "staff"
      ? [
          { to: "/staff", label: "Inventory" },
          { to: "/reservations", label: "Reservations" },
        ]
      : [{ to: "/dashboard", label: "My stays" }]),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 w-full max-w-6xl flex-row items-center justify-between px-6">
        <Link
          to="/"
          className="font-heading text-2xl text-foreground tracking-tight hover:opacity-90 transition-opacity"
        >
          StayBook
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm font-medium">
            {links.map(({ to, label }) => {
              return (
                <Link
                  key={to}
                  to={to}
                  className="text-muted-foreground/90 transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 py-1"
                  activeProps={{
                    className: "text-foreground font-semibold",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
