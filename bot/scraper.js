"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MijnDakScraper = void 0;
const playwright_1 = require("playwright");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
class MijnDakScraper {
    browser = null;
    context = null;
    page = null;
    async init() {
        this.browser = await playwright_1.chromium.launch({ headless: true });
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
        if (!this.page)
            throw new Error('Scraper not initialized');
        console.log('Navigating to login page...');
        await this.page.goto('https://amsterdam.mijndak.nl/Inloggen', { waitUntil: 'networkidle' });
        // Check if already logged in or login button exists
        const loginButton = this.page.locator('button:has-text("Inloggen"), a:has-text("Inloggen")').first();
        if (await loginButton.count() > 0) {
            console.log('Logging in...');
            await loginButton.click();
            await this.page.waitForSelector('input[name="UserName"]');
            await this.page.fill('input[name="UserName"]', process.env.MIJNDAK_USERNAME || '');
            await this.page.fill('input[name="Password"]', process.env.MIJNDAK_PASSWORD || '');
            // Accept cookies if present
            const cookieBtn = this.page.locator('button:has-text("Accepteren")').first();
            if (await cookieBtn.count() > 0) {
                await cookieBtn.click();
            }
            // Close fake-mail popup if present
            const kruisjeBtn = this.page.locator('use[href*="icon-kruisje"]').first();
            if (await kruisjeBtn.count() > 0) {
                await kruisjeBtn.click({ force: true });
            }
            const submitBtn = this.page.locator('button:has-text("Inloggen")').first();
            await submitBtn.click();
            await this.page.waitForTimeout(5000);
            console.log('Login completed. Current URL:', this.page.url());
        }
        else {
            console.log('Login button not found. Assuming already logged in or unexpected page state.');
        }
    }
    async syncAanbod() {
        if (!this.page)
            throw new Error('Scraper not initialized');
        console.log('Navigating to Aanbod...');
        await this.page.goto('https://amsterdam.mijndak.nl/WoningOverzicht', { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(5000); // Wait for React render
        const apartments = [];
        const apartmentCards = this.page.locator('a[href^="HuisDetails?PublicatieId="]');
        const count = await apartmentCards.count();
        for (let i = 0; i < count; i++) {
            const card = apartmentCards.nth(i);
            const text = await card.innerText();
            const href = await card.getAttribute('href');
            const publicatieId = href ? href.replace('HuisDetails?PublicatieId=', '') : '';
            const hasApplied = text.includes('hebt gereageerd') || text.includes('hebt  gereageerd');
            if (publicatieId) {
                apartments.push({
                    publicatieId,
                    isAvailableForApply: !hasApplied,
                    rawText: text
                });
            }
        }
        return apartments;
    }
    async applyToApartment(publicatieId) {
        if (!this.page)
            throw new Error('Scraper not initialized');
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
    async cancelApplication(publicatieId) {
        if (!this.page)
            throw new Error('Scraper not initialized');
        console.log(`Cancelling application for apartment ${publicatieId}...`);
        await this.page.goto(`https://amsterdam.mijndak.nl/HuisDetails?PublicatieId=${publicatieId}`, { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(5000);
        // Attempt to find cancellation button - the exact text might be "Reactie intrekken" or similar.
        // NOTE: This might need adjustment based on the actual UI text.
        const intrekkenBtn = this.page.locator('text="Reactie intrekken", text="Intrekken", text="Verwijderen"').first();
        if (await intrekkenBtn.count() > 0) {
            await intrekkenBtn.click();
            await this.page.waitForTimeout(3000);
            // Handle confirmation dialog if any
            const confirmBtn = this.page.locator('button:has-text("Ja"), button:has-text("Bevestigen")').first();
            if (await confirmBtn.count() > 0) {
                await confirmBtn.click();
                await this.page.waitForTimeout(3000);
            }
            console.log(`Successfully cancelled application for ${publicatieId}`);
            return true;
        }
        console.log(`Could not find cancel button for ${publicatieId}`);
        return false;
    }
    async syncReacties() {
        if (!this.page)
            throw new Error('Scraper not initialized');
        console.log('Navigating to Reacties...');
        await this.page.goto('https://amsterdam.mijndak.nl/ReactieOverzicht', { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(5000);
        const results = {
            actueel: [],
            lopend: [],
            historisch: []
        };
        // Helper to extract data from current tab
        const extractTab = async () => {
            const listItems = this.page.locator('.list-group > div, a[href^="HuisDetails?PublicatieId="]');
            const count = await listItems.count();
            const tabData = [];
            for (let i = 0; i < count; i++) {
                const item = listItems.nth(i);
                const text = await item.innerText();
                const href = await item.getAttribute('href');
                if (href && href.includes('PublicatieId=')) {
                    const publicatieId = href.split('PublicatieId=')[1];
                    // Try to parse position. Usually format is "Positie: X / Y" or "Positie: X"
                    let position = 999;
                    let totalCandidates = 999;
                    const posMatch = text.match(/Positie:\s*(\d+)\s*\/\s*(\d+)/i);
                    if (posMatch) {
                        position = parseInt(posMatch[1]);
                        totalCandidates = parseInt(posMatch[2]);
                    }
                    else {
                        const posMatchSingle = text.match(/Positie:\s*(\d+)/i);
                        if (posMatchSingle) {
                            position = parseInt(posMatchSingle[1]);
                        }
                    }
                    tabData.push({ publicatieId, position, totalCandidates, rawText: text });
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
exports.MijnDakScraper = MijnDakScraper;
