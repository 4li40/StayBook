import { Button } from "@StayBook/ui/components/button";
import { Link } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

import UserMenu from "./user-menu";

export default function Header() {
  const { data: session } = authClient.useSession();
  const role = session?.user.role;
  const links = [
    { to: "/rooms", label: "Find a room" },
    ...(session
      ? role === "staff"
        ? [
            { to: "/staff", label: "Inventory" },
            { to: "/reservations", label: "Reservations" },
          ]
        : [{ to: "/dashboard", label: "My stays" }]
      : []),
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-md transition-all">
      <nav className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="font-heading text-2xl text-foreground tracking-tight hover:opacity-90 transition-opacity"
        >
          StayBook
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6">
            {links.map(({ to, label }) => {
              return (
                <Link
                  key={to}
                  to={to}
                  className="relative text-sm font-medium text-muted-foreground/90 transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 py-1 group"
                  activeProps={{
                    className: "text-foreground font-semibold",
                  }}
                >
                  {label}
                  <span className="absolute left-0 -bottom-0.5 h-0.5 w-0 bg-gold transition-all duration-200 group-hover:w-full" />
                </Link>
              );
            })}
          </div>
          {session ? (
            <UserMenu />
          ) : (
            <Link to="/login">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
