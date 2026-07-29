import { MijnDakScraper } from './scraper.js';
import * as fs from 'fs';

async function test() {
  const scraper = new MijnDakScraper();
  await scraper.init();
  await scraper.login();
  
  await scraper.page!.goto('https://amsterdam.mijndak.nl/WoningOverzicht', { waitUntil: 'networkidle' });
  await scraper.page!.waitForTimeout(5000);
  
  const card = scraper.page!.locator('div[data-block*="WoningCard"]').first();
  const html = await card.innerHTML();
  fs.writeFileSync('card_dump.html', html);
  
  console.log('Saved card_dump.html');
  await scraper.close();
}

test().catch(console.error);

test().catch(console.error);
