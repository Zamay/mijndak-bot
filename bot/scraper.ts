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
    // Only get the large blocks representing an apartment card
    const apartmentCards = this.page.locator('div[data-block*="HuisBlock"]');
    
    let count = await apartmentCards.count();
    
    for (let i = 0; i < count; i++) {
      const card = apartmentCards.nth(i);
      
      const text = await card.innerText();
      const html = await card.innerHTML();
      
      // Look for the main link
      const innerLink = card.locator('a[href*="PublicatieId="]').first();
      if (await innerLink.count() === 0) continue;
      
      const href = await innerLink.getAttribute('href');
      let publicatieId = '';
      if (href) {
         const match = href.match(/PublicatieId=(\d+)/);
         if (match && match[1]) publicatieId = match[1];
      }
      
      if (!publicatieId) continue;
      
      // Filter out parking
      if (text.toLowerCase().includes('parkeerplaats')) {
         continue; // skip parking
      }

      // Extract image
      const img = card.locator('img').first();
      let imageUrl = '';
      if (await img.count() > 0) {
        imageUrl = await img.getAttribute('src') || '';
      }
      
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
      
      // Title is usually line 1, but sometimes line 0 is "100% wensmatch" or "Passend"
      let titleIndex = 0;
      if (lines.length > 0 && (lines[0].toLowerCase().includes('wensmatch') || lines[0].toLowerCase().includes('passend') || lines[0].toLowerCase().includes('nieuw'))) {
         titleIndex = 1;
      }
      const title = lines[titleIndex] || '';
      
      // Location is usually the line with city + neighborhood (e.g. Amsterdam, Noord)
      const location = lines.find(l => (l.includes(',') && !l.includes('€') && !l.match(/\d{2}-\d{2}/))) || '';
      
      // Price
      const priceMatch = text.match(/€\s*[\d.]+(?:,\d{2})?/);
      const price = priceMatch ? priceMatch[0] : '';
      
      // End date
      const dateMatch = text.match(/(\d{2}-\d{2}-\d{4},\s*\d{2}:\d{2})/);
      const endDate = dateMatch ? dateMatch[1] : '';
      
      // Additional specs (rooms, size, type)
      const specsMatch = text.match(/(\d+\s*Kamers\s*\|\s*\d+m²\s*\|\s*[a-zA-Z]+)/i);
      let specs = '';
      if (specsMatch) {
          specs = specsMatch[1] || '';
      } else {
          // Alternative fallback for "2 Kamers | 36m² | Portiekwoning" or bullet points
          const lineWithSpecs = lines.find(l => l.includes('m²'));
          specs = lineWithSpecs || '';
      }

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
        imageUrl,
        specs,
        rawText: text
      });
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
