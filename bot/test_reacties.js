import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
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
            const username = process.env.MIJNDAK_USERNAME;
            const password = process.env.MIJNDAK_PASSWORD;
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
            console.log('Clicking on Reacties in header...');
            const reactiesLink = page.locator('a:has-text("Reacties"), a[href*="ReactieOverzicht"]').first();
            await reactiesLink.click();
            console.log('Waiting for Reacties page to load...');
            await page.waitForTimeout(5000);
            // Screenshot the first tab (Actueel)
            await page.screenshot({ path: 'reacties_actueel.png', fullPage: true });
            const html1 = await page.content();
            fs.writeFileSync('reacties_actueel.html', html1);
            // Find the second tab (Lopend) and click it
            const lopendTab = page.locator('text="Lopend"').first();
            if (await lopendTab.count() > 0) {
                console.log('Clicking on Lopend tab...');
                await lopendTab.click();
                await page.waitForTimeout(3000);
                await page.screenshot({ path: 'reacties_lopend.png', fullPage: true });
            }
            // Find the third tab (Historisch) and click it
            const historischTab = page.locator('text="Historisch"').first();
            if (await historischTab.count() > 0) {
                console.log('Clicking on Historisch tab...');
                await historischTab.click();
                await page.waitForTimeout(3000);
                await page.screenshot({ path: 'reacties_historisch.png', fullPage: true });
            }
            console.log('Saved screenshots for Reacties tabs.');
            await browser.close();
        }
        else {
            console.log('No login button found by text "Inloggen".');
            const html = await page.content();
            fs.writeFileSync('login_failed.html', html);
            console.log('Saved login_failed.html for inspection');
            await browser.close();
        }
    }
    catch (err) {
        console.error('Error during scraping:', err);
        process.exit(1);
    }
}
run();
