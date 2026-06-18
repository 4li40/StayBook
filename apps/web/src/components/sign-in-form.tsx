import { Button } from "@StayBook/ui/components/button";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export const signInFormSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            void authClient.getSession().then((session) => {
              navigate({
                to: session.data?.user.role === "staff" ? "/staff" : "/dashboard",
              });
            });
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: signInFormSchema,
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto w-full">
      <div className="mb-7">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
          Returning guest
        </p>
        <h1 className="font-heading text-4xl leading-tight tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Open your reservation desk and manage upcoming stays.
        </p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <div>
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65"
                  />
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-12 rounded-lg border-primary/15 bg-background/75 pl-10 pr-3 text-sm shadow-inner shadow-primary/[0.03] focus-visible:border-primary/50 focus-visible:ring-primary/15"
                  />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-xs font-medium text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name} className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65"
                  />
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-12 rounded-lg border-primary/15 bg-background/75 pl-10 pr-3 text-sm shadow-inner shadow-primary/[0.03] focus-visible:border-primary/50 focus-visible:ring-primary/15"
                  />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-xs font-medium text-destructive">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              className="mt-3 h-12 w-full bg-primary text-sm font-bold tracking-[0.01em] shadow-[0_12px_28px_rgba(4,22,39,0.20)] hover:bg-primary/90"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
              <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" aria-hidden="true" />
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-6 border-t border-primary/10 pt-5 text-center">
        <Button
          variant="link"
          onClick={onSwitchToSignUp}
          className="h-auto px-0 text-sm font-semibold text-primary hover:text-primary/80"
        >
          Need an account? Create one
        </Button>
      </div>
    </div>
  );
}
