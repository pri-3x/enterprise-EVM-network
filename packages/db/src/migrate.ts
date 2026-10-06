import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Apply SQL migrations from packages/db/migrations. Safe to run repeatedly —
 * Drizzle tracks applied migrations in the __drizzle_migrations table.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(sql);
    const here = path.dirname(fileURLToPath(import.meta.url));
    // works both from src/ (tsx) and dist/ (compiled)
    const migrationsFolder = path.resolve(here, '..', 'migrations');
    await migrate(db, { migrationsFolder });
  } finally {
    await sql.end();
  }
}

// CLI entry: `npm run migrate -w @besu-net/db`
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => {
      process.stdout.write('migrations applied\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
