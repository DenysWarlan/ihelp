import { test as base, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import type { AuthTokens } from './global-setup';

/**
 * Fallback mock JWT tokens (structurally valid, fake signatures).
 * Used when global-setup hasn't run or API is unavailable.
 * The Angular auth guard only checks JWT existence + expiry in the browser;
 * these will pass the frontend guard but fail backend API calls.
 */
const MOCK_TOKENS: Record<string, string> = {
  person:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXBlcnNvbi0wMDEiLCJyb2xlIjoicGVyc29uIiwiZW1haWwiOiJwZXJzb25AdGVzdC5paGVscC5vcmciLCJpYXQiOjE3MTcwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock-person-sig',
  consultant:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWNvbnN1bHRhbnQtMDAxIiwicm9sZSI6ImNvbnN1bHRhbnQiLCJlbWFpbCI6ImNvbnN1bHRhbnRAdGVzdC5paGVscC5vcmciLCJpYXQiOjE3MTcwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock-consultant-sig',
  supervisor:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXN1cGVydmlzb3ItMDAxIiwicm9sZSI6InN1cGVydmlzb3IiLCJlbWFpbCI6InN1cGVydmlzb3JAdGVzdC5paGVscC5vcmciLCJpYXQiOjE3MTcwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock-supervisor-sig',
  coordinator:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWNvb3JkaW5hdG9yLTAwMSIsInJvbGUiOiJjb29yZGluYXRvciIsImVtYWlsIjoiY29vcmRpbmF0b3JAdGVzdC5paGVscC5vcmciLCJpYXQiOjE3MTcwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock-coordinator-sig',
  admin:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluLTAwMSIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AdGVzdC5paGVscC5vcmciLCJpYXQiOjE3MTcwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock-admin-sig',
};

/** Load real tokens from global-setup, fall back to mock tokens. */
function loadTokens(): Record<string, string> {
  const tokensPath = path.join(__dirname, '..', '.auth-tokens.json');
  try {
    const raw = fs.readFileSync(tokensPath, 'utf-8');
    const parsed: AuthTokens = JSON.parse(raw);
    const tokens: Record<string, string> = {};
    for (const [role, pair] of Object.entries(parsed)) {
      tokens[role] = pair.accessToken;
    }
    return tokens;
  } catch {
    console.warn('⚠ No .auth-tokens.json found — using mock tokens (API calls will fail)');
    return MOCK_TOKENS;
  }
}

const TOKENS = loadTokens();

const BASE_ORIGIN = 'http://localhost:4200';
const TOKEN_KEY = 'ihelp_token';

/** Metadata for each role, used to populate localStorage keys the guards check. */
const ROLE_META: Record<string, { role: string; name: string; email: string }> = {
  person: { role: 'person', name: 'Test Person', email: 'person@test.ihelp.org' },
  consultant: { role: 'consultant', name: 'Test Consultant', email: 'consultant@test.ihelp.org' },
  supervisor: { role: 'supervisor', name: 'Test Supervisor', email: 'supervisor@test.ihelp.org' },
  coordinator: { role: 'coordinator', name: 'Test Coordinator', email: 'coordinator@test.ihelp.org' },
  admin: { role: 'admin', name: 'Test Admin', email: 'admin@test.ihelp.org' },
};

/**
 * Creates a BrowserContext with the given token and role metadata pre-set
 * in localStorage, then opens a new Page within that context.
 *
 * The Angular guards check:
 *  - `ihelp_token` — authGuard (JWT existence + expiry)
 *  - `ihelp_user_role` — roleGuard (allowed roles)
 *  - `ihelp_user_name`, `ihelp_user_email` — display purposes
 */
async function createAuthenticatedPage(
  browser: import('@playwright/test').Browser,
  roleKey: string,
): Promise<{ page: Page; context: import('@playwright/test').BrowserContext }> {
  const token = TOKENS[roleKey] ?? MOCK_TOKENS[roleKey];
  const meta = ROLE_META[roleKey] ?? ROLE_META['person'];
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_ORIGIN,
          localStorage: [
            { name: TOKEN_KEY, value: token },
            { name: 'ihelp_user_role', value: meta.role },
            { name: 'ihelp_user_name', value: meta.name },
            { name: 'ihelp_user_email', value: meta.email },
          ],
        },
      ],
    },
  });
  const page = await context.newPage();
  return { page, context };
}

type AuthFixtures = {
  publicPage: Page;
  personPage: Page;
  staffPage: Page;
  coordinatorPage: Page;
  adminPage: Page;
  supervisorPage: Page;
};

export const test = base.extend<AuthFixtures>({
  /** Plain page with no authentication token set. */
  publicPage: async ({ page }, use) => {
    await use(page);
  },

  /** Page authenticated as a person (beneficiary). */
  personPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, 'person');
    await use(page);
    await context.close();
  },

  /** Page authenticated as a staff consultant. */
  staffPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, 'consultant');
    await use(page);
    await context.close();
  },

  /** Page authenticated as a coordinator. */
  coordinatorPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, 'coordinator');
    await use(page);
    await context.close();
  },

  /** Page authenticated as an admin. */
  adminPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, 'admin');
    await use(page);
    await context.close();
  },

  /** Page authenticated as a supervisor. */
  supervisorPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, 'supervisor');
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
export { MOCK_TOKENS, TOKEN_KEY, BASE_ORIGIN };
