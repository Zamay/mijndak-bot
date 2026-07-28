import { Page } from 'playwright';
import { BrowserService } from './BrowserService';

export class AuthService {
  constructor(private browserService: BrowserService) {}

  async login(page: Page): Promise<boolean> {
    console.log('Navigating to amsterdam.mijndak.nl...');
    await page.goto('https://amsterdam.mijndak.nl/', { waitUntil: 'networkidle' });

    // Check if already logged in (e.g. by checking if a specific element exists)
    // The exact selectors will need to be adjusted based on the actual HTML
    const isLoggedIn = await page.locator('text="Mijn overzicht"').isVisible().catch(() => false) || 
                       await page.locator('.user-profile-menu').isVisible().catch(() => false);

    if (isLoggedIn) {
      console.log('Already logged in based on saved state.');
      return true;
    }

    console.log('Not logged in. Proceeding with login...');
    
    // Find the login button and click it
    // Note: OutSystems might have dynamic IDs, so we use text or generic classes where possible
    const loginButton = page.locator('text="Inloggen"').first();
    if (await loginButton.isVisible()) {
        await loginButton.click();
        await page.waitForLoadState('networkidle');
    }

    const username = process.env.MIJNDAK_USERNAME;
    const password = process.env.MIJNDAK_PASSWORD;

    if (!username || !password) {
      throw new Error('MIJNDAK_USERNAME and MIJNDAK_PASSWORD must be set in .env');
    }

    // Fill in the form
    await page.fill('input[type="email"], input[name*="username"]', username);
    await page.fill('input[type="password"]', password);

    // Click submit
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Inloggen")');

    await page.waitForLoadState('networkidle');

    // Wait for a successful login indicator
    try {
      await page.waitForSelector('text="Mijn overzicht"', { timeout: 10000 });
      console.log('Successfully logged in!');
      await this.browserService.saveState();
      return true;
    } catch (e) {
      console.error('Failed to login. Please check credentials or if there is a CAPTCHA/2FA.');
      return false;
    }
  }
}
