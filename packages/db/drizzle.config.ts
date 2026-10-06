import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://besu:besu_dev_password@localhost:5433/besu_network',
  },
  strict: true,
  verbose: true,
});
