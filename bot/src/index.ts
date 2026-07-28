import { BrowserService } from './scraper/BrowserService';
import { AuthService } from './scraper/AuthService';
import { MonitorService } from './scraper/MonitorService';
import { TelegramService } from './services/TelegramService';
import { startWorkers, scheduleRecurringSync } from './jobs';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  console.log('Starting Amsterdam MijnDak Bot...');

  const browserService = new BrowserService();
  const authService = new AuthService(browserService);
  const monitorService = new MonitorService();
  const telegramService = new TelegramService();
  
  try {
    // Start Telegram bot
    await telegramService.start();

    // Start BullMQ workers
    startWorkers(browserService, authService, monitorService, telegramService);
    
    // Schedule the recurring sync job
    await scheduleRecurringSync();

  } catch (error) {
    console.error('Fatal error during startup:', error);
  }
}

main();
