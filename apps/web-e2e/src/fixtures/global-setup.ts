/**
 * Playwright global setup.
 *
 * Authenticates test users against the real API to obtain valid JWTs,
 * then writes them to a shared file that the auth fixture reads.
 *
 * Requires:
 * - API running on port 8888 (started by playwright.config.ts webServer)
 * - E2E seed data loaded (npx tsx libs/prisma-client/prisma/seed-e2e.ts)
 */
import { request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = process.env['API_BASE_URL'] || 'http://localhost:8888';
const TEST_PASSWORD = 'TestPassword1!';

const STAFF_ACCOUNTS = [
  { key: 'consultant', email: 'consultant@test.ihelp.org' },
  { key: 'supervisor', email: 'supervisor@test.ihelp.org' },
  { key: 'coordinator', email: 'coordinator@test.ihelp.org' },
  { key: 'admin', email: 'admin@test.ihelp.org' },
];

const PERSON_ACCOUNT = { key: 'person', email: 'person@test.ihelp.org' };

export interface AuthTokens {
  [role: string]: { accessToken: string; refreshToken: string };
}

const TOKENS_PATH = path.join(__dirname, '..', '.auth-tokens.json');

async function globalSetup() {
  console.log('\n🔐 Global setup: authenticating test users...');

  const ctx = await request.newContext({ baseURL: API_BASE });
  const tokens: AuthTokens = {};

  // Staff users: POST /api/auth/staff/login
  for (const account of STAFF_ACCOUNTS) {
    try {
      const res = await ctx.post('/api/auth/staff/login', {
        data: { email: account.email, password: TEST_PASSWORD },
      });

      if (res.ok()) {
        const body = await res.json();
        tokens[account.key] = {
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
        };
        console.log(`  ✓ ${account.key}: authenticated`);
      } else {
        const text = await res.text();
        console.warn(`  ✗ ${account.key}: ${res.status()} — ${text}`);
      }
    } catch (err) {
      console.warn(`  ✗ ${account.key}: network error — ${err}`);
    }
  }

  // Person user: POST /api/auth/person/login
  try {
    const res = await ctx.post('/api/auth/person/login', {
      data: { email: PERSON_ACCOUNT.email, password: TEST_PASSWORD },
    });

    if (res.ok()) {
      const body = await res.json();
      tokens[PERSON_ACCOUNT.key] = {
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
      };
      console.log(`  ✓ person: authenticated`);
    } else {
      const text = await res.text();
      console.warn(`  ✗ person: ${res.status()} — ${text}`);
    }
  } catch (err) {
    console.warn(`  ✗ person: network error — ${err}`);
  }

  await ctx.dispose();

  // Write tokens to disk so the auth fixture can read them
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  console.log(`  📄 Tokens saved to ${TOKENS_PATH}\n`);
}

export default globalSetup;
