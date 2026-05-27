import { test as base, Page } from '@playwright/test';

/**
 * Mock JWT tokens for each role.
 * The Angular auth guard only checks for the existence of 'ihelp_token'
 * in localStorage — it does not validate the JWT signature in the browser.
 * These are structurally valid JWTs with fake payloads.
 */
const MOCK_TOKENS = {
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
} as const;

const BASE_ORIGIN = 'http://localhost:4200';
const TOKEN_KEY = 'ihelp_token';

/**
 * Creates a BrowserContext with the given token pre-set in localStorage,
 * then opens a new Page within that context.
 */
async function createAuthenticatedPage(
  browser: import('@playwright/test').Browser,
  token: string,
): Promise<{ page: Page; context: import('@playwright/test').BrowserContext }> {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_ORIGIN,
          localStorage: [{ name: TOKEN_KEY, value: token }],
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
    const { page, context } = await createAuthenticatedPage(browser, MOCK_TOKENS.person);
    await use(page);
    await context.close();
  },

  /** Page authenticated as a staff consultant. */
  staffPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, MOCK_TOKENS.consultant);
    await use(page);
    await context.close();
  },

  /** Page authenticated as a coordinator. */
  coordinatorPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, MOCK_TOKENS.coordinator);
    await use(page);
    await context.close();
  },

  /** Page authenticated as an admin. */
  adminPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, MOCK_TOKENS.admin);
    await use(page);
    await context.close();
  },

  /** Page authenticated as a supervisor. */
  supervisorPage: async ({ browser }, use) => {
    const { page, context } = await createAuthenticatedPage(browser, MOCK_TOKENS.supervisor);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
export { MOCK_TOKENS, TOKEN_KEY, BASE_ORIGIN };
