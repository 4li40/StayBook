import { auth } from "@StayBook/auth";
import { env } from "@StayBook/env/server";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { errorHandler } from "./api/http";
import {
  authCredentialRateLimit,
  authEndpointRateLimit,
  readEndpointRateLimit,
} from "./api/rate-limit";
import { reservationsRouter } from "./api/routes/reservations";
import { roomsRouter } from "./api/routes/rooms";
import { staffRouter } from "./api/routes/staff";

const app = express();

app.disable("x-powered-by");

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use("/api/auth/sign-in/email", authCredentialRateLimit);
app.use("/api/auth/sign-up/email", authCredentialRateLimit);
app.use("/api/auth", authEndpointRateLimit);
app.all("/api/auth{/*path}", toNodeHandler(auth));

app.use(express.json({ limit: "64kb" }));

app.use("/api", readEndpointRateLimit);
app.use("/api/rooms", roomsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/staff", staffRouter);

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
