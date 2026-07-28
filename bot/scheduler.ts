import * as cron from 'node-cron';
import { runLogicCycle } from './index.js';

console.log('--- MijnDak Bot Scheduler Started ---');
console.log('Schedules configured:');
console.log('- 00:02 every day (Midnight run)');
console.log('- 13:00 every day (Lunch run)');
console.log('- 08:00 every day (Morning sync)');

// Run at 00:02 every day
cron.schedule('2 0 * * *', () => {
  console.log('Running midnight logic cycle...');
  runLogicCycle();
});

// Run at 13:00 every day (lunch time)
cron.schedule('0 13 * * *', () => {
  console.log('Running lunch logic cycle...');
  runLogicCycle();
});

// Run at 08:00 every day (morning)
cron.schedule('0 8 * * *', () => {
  console.log('Running morning logic cycle...');
  runLogicCycle();
});

// If you want to test it immediately, uncomment the line below:
// runLogicCycle();
