import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;
export type SqlClient = ReturnType<typeof postgres>;

export interface DbOptions {
  /** Max pool connections (default 10) */
  max?: number;
  /** Idle connection timeout in seconds (default 30) */
  idleTimeout?: number;
  /** Connection attempt timeout in seconds (default 10) */
  connectTimeout?: number;
}

export interface DbHandle {
  db: Database;
  sql: SqlClient;
  /** Lightweight connectivity probe used by /health and /ready */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDb(databaseUrl: string, opts: DbOptions = {}): DbHandle {
  const sql = postgres(databaseUrl, {
    max: opts.max ?? 10,
    idle_timeout: opts.idleTimeout ?? 30,
    connect_timeout: opts.connectTimeout ?? 10,
    // int8 / numeric(78,0) are returned as strings by postgres.js; Drizzle maps
    // them to number/bigint per column so precision is never silently lost.
    onnotice: () => {},
  });

  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    async ping() {
      try {
        await sql`select 1`;
        return true;
      } catch {
        return false;
      }
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
