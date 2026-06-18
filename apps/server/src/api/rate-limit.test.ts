import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createRateLimit } from "./rate-limit";

function createTestApp() {
  const app = express();

  app.use(
    createRateLimit({
      windowMs: 60 * 1000,
      limit: 2,
      message: "Too many test requests.",
    }),
  );
  app.get("/limited", (_req, res) => {
    res.status(200).json({ data: "ok" });
  });
  app.options("/limited", (_req, res) => {
    res.status(204).send();
  });

  return app;
}

describe("createRateLimit", () => {
  it("returns the API error envelope after the limit is exceeded", async () => {
    const app = createTestApp();

    await request(app).get("/limited").expect(200);
    await request(app).get("/limited").expect(200);

    const res = await request(app).get("/limited");

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many test requests.",
      },
    });
  });

  it("does not count CORS preflight requests", async () => {
    const app = createTestApp();

    await request(app).options("/limited").expect(204);
    await request(app).options("/limited").expect(204);
    await request(app).options("/limited").expect(204);

    await request(app).get("/limited").expect(200);
    await request(app).get("/limited").expect(200);
  });
});
