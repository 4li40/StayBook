import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth-client", () => ({
  authClient: {
    getSession: vi.fn(),
  },
}));

import { authClient } from "./auth-client";
import { fetchCurrentSession, sessionQueryKey } from "./session-query";

const getSession = vi.mocked(authClient.getSession);

afterEach(() => {
  getSession.mockReset();
});

describe("fetchCurrentSession", () => {
  it("replaces a cached staff role with the current guest session", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(sessionQueryKey, {
      user: { id: "staff-1", role: "staff" },
      session: { id: "staff-session" },
    });
    getSession.mockResolvedValue({
      data: {
        user: { id: "guest-1", role: "guest" },
        session: { id: "guest-session" },
      },
      error: null,
    } as never);

    const session = await fetchCurrentSession(client);

    expect(getSession).toHaveBeenCalledOnce();
    expect(session?.user.role).toBe("guest");
    expect(client.getQueryData(sessionQueryKey)).toEqual(session);
  });
});
