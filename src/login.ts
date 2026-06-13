/**
 * CAS SSO login via Playwright browser automation.
 *
 * Opens a headed Chromium browser, navigates to the cstcloud Overleaf instance,
 * waits for the user to complete CAS (中国科技云通行证) SSO, extracts the
 * `overleaf.sid` cookie, and stores it in the olcli config.
 */

import { chromium } from 'playwright';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getBaseUrl, getSessionCookieName, setSessionCookie } from './config.js';

const PLAYWRIGHT_USER_DATA = join(homedir(), '.config', 'olcli-cstcloud', 'playwright');

export interface LoginResult {
  cookie: string;
  projectId?: string;
}

/**
 * Launch headed browser for CAS SSO login.
 *
 * @param shareUrl  Optional share URL (e.g. https://latex.cstcloud.cn/<token>).
 *                  If provided, the browser navigates directly to it, which
 *                  both triggers CAS SSO and resolves the projectId.
 */
export async function casLogin(shareUrl?: string): Promise<LoginResult> {
  const baseUrl = getBaseUrl();
  const cookieName = getSessionCookieName();

  const context = await chromium.launchPersistentContext(PLAYWRIGHT_USER_DATA, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  const target = shareUrl || `${baseUrl}/project`;

  console.log(`Opening browser: ${target}`);
  console.log('Complete CAS SSO login in the browser window (up to 5 minutes)...');

  await page.goto(target);

  try {
    // Wait for the user to land on /project/<24-hex-id> after CAS redirect
    await page.waitForURL(/\/project\/[a-f0-9]{24}/, { timeout: 300_000 });
  } catch {
    await context.close();
    throw new Error('Login timed out after 5 minutes.');
  }

  const currentUrl = page.url();
  const cookies = await context.cookies(baseUrl);

  const sid = cookies.find(c => c.name === cookieName)?.value;
  if (!sid) {
    await context.close();
    const available = cookies.map(c => c.name).join(', ') || '(none)';
    throw new Error(
      `Could not find '${cookieName}' cookie. Available cookies: ${available}`
    );
  }

  const projectIdMatch = currentUrl.match(/\/project\/([a-f0-9]{24})/);
  const projectId = projectIdMatch?.[1];

  await context.close();

  // Persist cookie
  setSessionCookie(sid);
  console.log('Cookie saved to config.');

  if (projectId) {
    console.log(`Project ID: ${projectId}`);
  }

  return { cookie: sid, projectId };
}
