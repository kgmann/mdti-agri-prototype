// Database clients. Only modules in src/core (and src/ai for the read-only client) use them.
import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql; readonlySql?: postgres.Sql };

// Numeric columns come back as numbers (values here fit comfortably in a double).
const types = { numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) } };

export const sql = globalForDb.sql ?? postgres(process.env.DATABASE_URL!, { max: 10, types, onnotice: () => {} });

// Read-only user (SELECT only, read-only transactions, 5 s statement timeout) for AI-generated queries.
export const readonlySql =
  globalForDb.readonlySql ?? postgres(process.env.READONLY_DATABASE_URL!, { max: 3, types, onnotice: () => {} });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
  globalForDb.readonlySql = readonlySql;
}
