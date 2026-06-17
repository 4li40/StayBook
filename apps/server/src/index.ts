import { auth } from "@StayBook/auth";
import { env } from "@StayBook/env/server";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { errorHandler } from "./api/http";
import { reservationsRouter } from "./api/routes/reservations";
import { roomsRouter } from "./api/routes/rooms";
import { staffRouter } from "./api/routes/staff";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.all("/api/auth{/*path}", toNodeHandler(auth));

app.use(express.json());

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
