import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private stateFile = path.join(__dirname, '../../state.json');

  async init(): Promise<Page> {
    this.browser = await chromium.launch({ headless: process.env.NODE_ENV === 'production' });

    let contextOptions = {
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    };

    if (fs.existsSync(this.stateFile)) {
      console.log('Loading existing browser state...');
      this.context = await this.browser.newContext({
        ...contextOptions,
        storageState: this.stateFile,
      });
    } else {
      console.log('No state file found, creating new context...');
      this.context = await this.browser.newContext(contextOptions);
    }

    return await this.context.newPage();
  }

  async saveState() {
    if (this.context) {
      await this.context.storageState({ path: this.stateFile });
      console.log('Browser state saved.');
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
