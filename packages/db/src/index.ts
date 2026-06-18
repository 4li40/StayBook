import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "@StayBook/env/server";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export function createDb() {
  const sql = neon(env.DATABASE_URL);
  return { db: drizzle(sql, { schema }), sql };
}

const instance = createDb();
export const db = instance.db;
export const neonSql = instance.sql;
export type NeonSql = NeonQueryFunction<boolean, boolean>;



