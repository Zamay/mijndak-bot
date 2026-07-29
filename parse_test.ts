import * as fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('bot/woningaanbod_dump.html', 'utf-8');
const $ = cheerio.load(html);

const links = $('a[href*="PublicatieId="]');
console.log(`Found ${links.length} links`);

if (links.length > 0) {
  const firstLink = links.first();
  console.log('HTML of first card:', firstLink.parent().parent().html());
}
