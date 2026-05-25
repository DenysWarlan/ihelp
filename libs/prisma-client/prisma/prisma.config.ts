import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://ihelp:ihelp_secret@localhost:5433/ihelp',
  },
  migrations: {
    seed: 'npx ts-node prisma/seed.ts',
  },
  migrate: {
    async resolveConnectionString() {
      return process.env['DATABASE_URL'] ?? 'postgresql://ihelp:ihelp_secret@localhost:5433/ihelp';
    },
  },
});
