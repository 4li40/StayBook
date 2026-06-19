import type { auth } from "@StayBook/auth";
import { env } from "@StayBook/env/web";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: false,
    refetchWhenOffline: false,
  },
});
