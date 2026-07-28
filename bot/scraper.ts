import * as fs from 'fs';
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export class MijnDakScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  public page: Page | null = null;

  async init() {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    });
    this.page = await this.context.newPage();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async login() {
    if (!this.page) throw new Error('Scraper not initialized');
    
    console.log('Navigating to login page...');
    await this.page.goto('https://amsterdam.mijndak.nl/Inloggen', { waitUntil: 'networkidle' });
    
    // Check if we need to login by looking for the username field
    await this.page.waitForSelector('input[id="Input_UsernameVal"]', { timeout: 10000 }).catch(() => {});
    const usernameInput = this.page.locator('input[id="Input_UsernameVal"]');
    if (await usernameInput.count() > 0) {
      console.log('Logging in...');
      
      // Close Cookie Popup
      try {
        await this.page.click('#cookiescript_accept', { timeout: 2000 });
      } catch (e) {}

      // Close Spam/Phishing Popup
      try {
        await this.page.click('.popup-dialog i.fa-times', { timeout: 2000 });
      } catch (e) {}
      
      // Type credentials normally (no force, since popups are gone)
      await usernameInput.fill(process.env.MIJNDAK_USERNAME || '');
      await this.page.locator('input[id="Input_PasswordVal"]').fill(process.env.MIJNDAK_PASSWORD || '');
      
      // Press Enter to submit the form natively
      await this.page.locator('input[id="Input_PasswordVal"]').press('Enter');
      
      await this.page.waitForTimeout(5000);
      console.log('Login completed. Current URL:', this.page.url());
    } else {
      await this.page.screenshot({ path: 'debug_login.png', fullPage: true });
      console.log('Login button not found. Saved screenshot to debug_login.png.');
    }
  }

  async syncAanbod() {
    if (!this.page) throw new Error('Scraper not initialized');
    
    console.log('Navigating to Aanbod...');
    await this.page.goto('https://amsterdam.mijndak.nl/WoningOverzicht', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(5000); // Wait for React render

    const apartments = [];
    const apartmentCards = this.page.locator('.list-group > div.list-item, div[data-block*="WoningCard"]');
    
    // Fallback if cards not found
    let cardsToIterate = apartmentCards;
    let count = await cardsToIterate.count();
    
    if (count === 0) {
       // Just grab the links directly
       cardsToIterate = this.page.locator('a[href*="PublicatieId="]');
       count = await cardsToIterate.count();
    }

    for (let i = 0; i < count; i++) {
      const card = cardsToIterate.nth(i);
      const text = await card.innerText();
      
      let href = await card.getAttribute('href');
      if (!href) {
        // Try finding link inside the card
        const innerLink = card.locator('a[href*="PublicatieId="]').first();
        if (await innerLink.count() > 0) {
           href = await innerLink.getAttribute('href');
        }
      }
      
      let publicatieId = '';
      if (href) {
         const match = href.match(/PublicatieId=(\d+)/);
         if (match && match[1]) publicatieId = match[1];
      }
      
      // Also match weird spacing like 'hebt  gereageerd'
      const hasApplied = /hebt\s+gereageerd/i.test(text);
      let position = 99999;
      let totalCandidates = 99999;

      const posMatch = text.match(/positie:\s*(\d+)\s*\/\s*(\d+)/i);
      if (posMatch) {
        position = parseInt(posMatch[1] || '99999');
        totalCandidates = parseInt(posMatch[2] || '99999');
      } else {
        const posMatchSingle = text.match(/positie:\s*(\d+)/i);
        if (posMatchSingle) {
          position = parseInt(posMatchSingle[1] || '99999');
        }
      }
      
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const title = lines[0] || '';
      const location = lines.find(l => l.includes(',') && !l.includes('€')) || '';
      
      const priceMatch = text.match(/€\s*[\d.]+(?:,\d{2})?/);
      const price = priceMatch ? priceMatch[0] : '';
      
      const dateMatch = text.match(/(\d{2}-\d{2}-\d{4},\s*\d{2}:\d{2})/);
      const endDate = dateMatch ? dateMatch[1] : '';

      if (publicatieId) {
        apartments.push({
          publicatieId,
          isAvailableForApply: !hasApplied,
          hasApplied,
          position,
          totalCandidates,
          title,
          location,
          price,
          endDate,
          rawText: text
        });
      }
    }
    return apartments;
  }

  async applyToApartment(publicatieId: string): Promise<boolean> {
    if (!this.page) throw new Error('Scraper not initialized');
    
    console.log(`Applying to apartment ${publicatieId}...`);
    await this.page.goto(`https://amsterdam.mijndak.nl/HuisDetails?PublicatieId=${publicatieId}`, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(5000);
    
    const reactBtn = this.page.locator('text="Reageren op deze woning"').first();
    if (await reactBtn.count() > 0) {
      await reactBtn.click();
      await this.page.waitForTimeout(5000);
      console.log(`Successfully clicked apply for ${publicatieId}`);
      return true;
    }
    
    console.log(`Could not find apply button for ${publicatieId}`);
    return false;
  }

  async cancelApplication(publicatieId: string): Promise<boolean> {
    if (!this.page) throw new Error('Scraper not initialized');
    
    console.log(`Cancelling application for apartment ${publicatieId}...`);
    await this.page.goto(`https://amsterdam.mijndak.nl/HuisDetails?PublicatieId=${publicatieId}`, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(5000);
    
    const cancelBtn = this.page.locator('button, a').locator('text=/Reactie intrekken/i').first();
    
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      console.log(`Successfully clicked cancel for ${publicatieId}`);
      
      // Wait for any confirmation dialog/popup and confirm
      await this.page.waitForTimeout(2000);
      const confirmBtn = this.page.locator('button').locator('text=/Bevestigen|Ja, intrekken|Intrekken/i').first();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
        console.log(`Confirmed cancellation for ${publicatieId}`);
      }
      return true;
    }
    
    console.log(`Could not find cancel button for ${publicatieId}`);
    return false;
  }

  async syncReacties() {
    if (!this.page) throw new Error('Scraper not initialized');
    
    console.log('Navigating to Reacties...');
    await this.page.goto('https://amsterdam.mijndak.nl/ReactieOverzicht', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(5000);
    
    fs.writeFileSync('reacties_dump.html', await this.page.content());

    const results = {
      actueel: [] as any[],
      lopend: [] as any[],
      historisch: [] as any[]
    };

    // Helper to extract data from current tab
    const extractTab = async () => {
      const listItems = this.page!.locator('.list-group > div.list-item');
      const count = await listItems.count();
      const tabData = [];
      for (let i = 0; i < count; i++) {
        const item = listItems.nth(i);
        const text = await item.innerText();
        
        // Find inner link
        const link = item.locator('a[href*="PublicatieId="]');
        if (await link.count() > 0) {
          const href = await link.first().getAttribute('href');
          if (href) {
            const publicatieIdMatch = href.match(/PublicatieId=(\d+)/);
            if (publicatieIdMatch) {
              const publicatieId = publicatieIdMatch[1];
              let position = 999;
              let totalCandidates = 999;
              
              // Text usually has "Voorlopige positie:4592 / 5556" or "Positie:2398 / 2676"
              const posMatch = text.match(/positie:\s*(\d+)\s*\/\s*(\d+)/i);
              if (posMatch) {
                position = parseInt(posMatch[1] || '999');
                totalCandidates = parseInt(posMatch[2] || '999');
              } else {
                const posMatchSingle = text.match(/positie:\s*(\d+)/i);
                if (posMatchSingle) {
                  position = parseInt(posMatchSingle[1] || '999');
                }
              }
              tabData.push({ publicatieId, position, totalCandidates, rawText: text });
            }
          }
        }
      }
      return tabData;
    };

    // 1. Actueel
    const actueelTab = this.page.locator('text="Actueel"').first();
    if (await actueelTab.count() > 0) {
        await actueelTab.click();
        await this.page.waitForTimeout(2000);
        results.actueel = await extractTab();
    }

    // 2. Lopend
    const lopendTab = this.page.locator('text="Lopend"').first();
    if (await lopendTab.count() > 0) {
        await lopendTab.click();
        await this.page.waitForTimeout(2000);
        results.lopend = await extractTab();
    }
    
    // 3. Historisch
    const historischTab = this.page.locator('text="Historisch"').first();
    if (await historischTab.count() > 0) {
        await historischTab.click();
        await this.page.waitForTimeout(2000);
        results.historisch = await extractTab();
    }

    return results;
  }
}
