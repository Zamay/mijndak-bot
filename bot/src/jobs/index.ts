import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { BrowserService } from '../scraper/BrowserService';
import { MonitorService, ApartmentData } from '../scraper/MonitorService';
import { AuthService } from '../scraper/AuthService';
import { TelegramService } from './TelegramService';

const connection = new IORedis(process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` : 'redis://localhost:6379');

export const syncQueue = new Queue('sync-mijndak', { connection });
export const applyQueue = new Queue('apply-mijndak', { connection });

export function startWorkers(
  browserService: BrowserService, 
  authService: AuthService, 
  monitorService: MonitorService,
  telegramService: TelegramService
) {
  
  // Worker for checking new apartments
  const syncWorker = new Worker('sync-mijndak', async (job: Job) => {
    console.log(`[Job ${job.id}] Starting sync...`);
    try {
      const page = await browserService.init();
      
      const loggedIn = await authService.login(page);
      if (!loggedIn) {
        throw new Error('Could not login to fetch apartments.');
      }

      const apartments = await monitorService.fetchNewApartments(page);
      
      if (apartments.length > 0) {
        console.log(`Found ${apartments.length} apartments.`);
        // Here we would check DB if they are new, apply filters, etc.
        // For now, let's just trigger apply jobs for demonstration if they pass criteria
        
        for (const apt of apartments) {
          // Check filters
          if (process.env.FILTER_MAX_PRICE && apt.price > Number(process.env.FILTER_MAX_PRICE)) continue;
          
          // If new, push to apply queue
          await applyQueue.add('apply', { apartment: apt });
          await telegramService.notifyNewApartment(apt);
        }
      } else {
        console.log('No apartments found on this run.');
      }
      
      // We don't close the browser context to keep the session hot
      // But we might want to close the page to save memory
      await page.close();
      
    } catch (e) {
      console.error(`[Job ${job.id}] Failed:`, e);
      await telegramService.notifyError(e instanceof Error ? e.message : 'Unknown error during sync');
    }
  }, { connection });

  // Worker for applying to an apartment
  const applyWorker = new Worker('apply-mijndak', async (job: Job) => {
    const apt: ApartmentData = job.data.apartment;
    console.log(`[Job ${job.id}] Applying for apartment: ${apt.id}`);
    
    // Here would be the logic to use Playwright to actually submit the form
    // await applicationService.apply(apt);
    
    // On success:
    await telegramService.notifyApplied(apt);
    
  }, { connection });

  console.log('BullMQ Workers started.');
}

export async function scheduleRecurringSync() {
  // Add a repeatable job that runs every 60 seconds
  await syncQueue.add('sync', {}, {
    repeat: {
      every: 60000,
    }
  });
  console.log('Scheduled recurring sync job.');
}
