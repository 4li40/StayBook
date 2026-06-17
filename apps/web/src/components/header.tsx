import { Link } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const { data: session } = authClient.useSession();
  const role = session?.user.role;
  const links = [
    { to: "/", label: "Find a room" },
    ...(role === "staff"
      ? [{ to: "/staff", label: "Inventory" }]
      : [{ to: "/dashboard", label: "My stays" }]),
  ];

  return (
    <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl flex-row items-center justify-between px-4">
        <nav className="flex items-center gap-6">
          <Link to="/" className="font-heading text-xl text-foreground tracking-tight">
            StayBook
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            {links.map(({ to, label }) => {
              return (
                <Link
                  key={to}
                  to={to}
                  className="text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  activeProps={{
                    className: "text-foreground",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
