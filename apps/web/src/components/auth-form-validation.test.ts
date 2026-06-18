import { describe, expect, it } from "vitest";

import { signInFormSchema } from "./sign-in-form";
import { signUpFormSchema } from "./sign-up-form";

function messagesFrom(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}) {
  if (result.success) {
    return [];
  }

  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("auth form validation", () => {
  it("returns visible sign-in validation messages", () => {
    const result = signInFormSchema.safeParse({
      email: "not-an-email",
      password: "short",
    });

    expect(messagesFrom(result)).toEqual(
      expect.arrayContaining([
        "Invalid email address",
        "Password must be at least 8 characters",
      ]),
    );
  });

  it("returns visible sign-up validation messages", () => {
    const result = signUpFormSchema.safeParse({
      name: "A",
      email: "not-an-email",
      password: "short",
    });

    expect(messagesFrom(result)).toEqual(
      expect.arrayContaining([
        "Name must be at least 2 characters",
        "Invalid email address",
        "Password must be at least 8 characters",
      ]),
    );
  });

  it("accepts valid sign-up data", () => {
    const result = signUpFormSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct horse battery staple",
    });

    expect(result.success).toBe(true);
  });
});
