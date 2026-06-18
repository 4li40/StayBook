import { createFileRoute } from "@tanstack/react-router";
import { BedDouble, Sparkles } from "lucide-react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <main className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden bg-[#f7f5f0] text-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(254,212,136,0.34),transparent_28%),radial-gradient(circle_at_50%_72%,rgba(183,200,222,0.22),transparent_32%)]"
      />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-8 lg:min-h-0">
          <div className="w-full max-w-md">
            <div className="mx-5 mb-5 flex items-center justify-between sm:mx-7">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <BedDouble className="size-4" aria-hidden="true" />
                StayBook
              </div>
              <Sparkles className="size-4 text-gold" aria-hidden="true" />
            </div>
            <div className="rounded-lg border border-primary/10 bg-white/82 p-5 shadow-[0_24px_70px_rgba(27,28,29,0.10)] backdrop-blur-xl sm:p-7">
              {showSignIn ? (
                <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
              ) : (
                <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
