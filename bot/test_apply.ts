import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: '../.env' });

async function run() {
  console.log('Starting playwright test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto('https://amsterdam.mijndak.nl/', { waitUntil: 'networkidle' });
    console.log('Page loaded.');
    
    // Attempt to take a screenshot of home page
    await page.screenshot({ path: 'home.png' });
    console.log('Saved home.png');

    const loginButton = page.locator('text="Inloggen"').first();
    if (await loginButton.isVisible()) {
      console.log('Clicking login...');
      await loginButton.click();
      await page.waitForLoadState('networkidle');
      
      const username = process.env.MIJNDAK_USERNAME!;
      const password = process.env.MIJNDAK_PASSWORD!;

      console.log('Filling form...');
      // Wait a bit for cookie banner
      await page.waitForTimeout(1000);
      
      const cookieAccept = page.locator('#cookiescript_accept');
      if (await cookieAccept.isVisible()) {
        console.log('Accepting cookies...');
        await cookieAccept.click();
        await page.waitForTimeout(500);
      }
      
      const popupClose = page.locator('.popup-dialog a i.fa-times').first();
      if (await popupClose.isVisible()) {
        console.log('Closing popup...');
        await popupClose.click();
        await page.waitForTimeout(500);
      }
      
      await page.fill('#Input_UsernameVal', username);
      await page.fill('#Input_PasswordVal', password);
      
      console.log('Submitting...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => console.log('Navigation timeout')),
        page.click('button[type="submit"]', { force: true })
      ]);
      
      console.log('Navigation complete. Checking URL:', page.url());
      
      console.log('Waiting 5 seconds for React to render apartments...');
      await page.waitForTimeout(5000);
      
      const html2 = await page.content();
      fs.writeFileSync('woningaanbod_page_rendered.html', html2);
      await page.screenshot({ path: 'woningaanbod_rendered.png', fullPage: true });
      console.log('Saved woningaanbod_page_rendered.html for inspection');

      // Now try to find the first apartment link
      console.log('Searching for apartments...');
      const apartmentLinks = page.locator('a[href^="HuisDetails?PublicatieId="]');
      const count = await apartmentLinks.count();
      console.log(`Found ${count} apartments.`);

      let targetLink = null;
      for (let i = 0; i < count; i++) {
        const link = apartmentLinks.nth(i);
        const text = await link.innerText();
        if (!text.includes('hebt gereageerd') && !text.includes('hebt  gereageerd')) {
          console.log(`Apartment ${i} is available!`);
          targetLink = link;
          break;
        }
      }

      if (targetLink) {
        console.log('Clicking the available apartment...');
        await targetLink.click();
        
        console.log('Waiting for apartment details page to load...');
        await page.waitForTimeout(5000); // Wait for page to fully load
        
        // Find the react button
        const reactBtn = page.locator('text="Reageren op deze woning"').first();
        if (await reactBtn.count() > 0) {
            console.log('Found the react button! Clicking it...');
            await reactBtn.click();
            await page.waitForTimeout(5000); // wait for reaction to process
            await page.screenshot({ path: 'apartment_applied.png', fullPage: true });
            console.log('Saved apartment_applied.png');
        } else {
            console.log('Could not find the "Reageren op deze woning" button.');
            await page.screenshot({ path: 'apartment_no_btn.png', fullPage: true });
        }
      } else {
        console.log('No apartments available to apply for (all have "gereageerd").');
      }

      await browser.close();
    } else {
      console.log('No login button found by text "Inloggen".');
      const html = await page.content();
      fs.writeFileSync('home_page.html', html);
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

run();
