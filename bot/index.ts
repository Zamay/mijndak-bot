import { MijnDakScraper } from './scraper.js';
import * as db from './db.js';

const MAX_ACTIVE_APPLICATIONS = 2;
const WORST_POSITION_TO_CANCEL = 100;

async function runLogicCycle() {
  console.log('--- Starting Bot Logic Cycle ---', new Date().toISOString());
  
  const scraper = new MijnDakScraper();
  try {
    await scraper.init();
    await scraper.login();

    // 1. Fetch current active apps in DB to fix the 4/2 bug
    const activeAppsBefore = await db.getActiveApplications();
    const activeAppIds = new Set(activeAppsBefore.map(a => a.publicatieId));

    // 2. Sync Reacties first to get accurate state
    console.log('Syncing current applications (Reacties)...');
    const reacties = await scraper.syncReacties();
    
    // Update DB with current Actueel apps
    const currentActueelIds = new Set<string>();
    for (const app of reacties.actueel) {
      currentActueelIds.add(app.publicatieId);
      await db.saveApplication({
        publicatieId: app.publicatieId,
        position: app.position,
        totalCandidates: app.totalCandidates,
        status: 'APPLIED',
        appliedAt: new Date(), // this will be updated correctly later if we already have it
        updatedAt: new Date()
      });
    }

    // Any app that was APPLIED but is not in Actueel anymore should be marked CANCELLED
    for (const appId of activeAppIds) {
      if (!currentActueelIds.has(appId)) {
        console.log(`Application ${appId} is no longer in Actueel. Marking as CANCELLED in DB.`);
        await db.cancelApplicationDB(appId);
      }
    }

    // 3. Sync Aanbod (available apartments)
    console.log('Syncing available apartments (Aanbod)...');
    const apartments = await scraper.syncAanbod();
    
    for (const apt of apartments) {
      const aptData: any = {
        publicatieId: apt.publicatieId,
        discoveryTime: new Date(),
        status: apt.isAvailableForApply ? 'AVAILABLE' : 'UNAVAILABLE'
      };
      
      if (apt.title) aptData.address = apt.title;
      if (apt.location) aptData.type = apt.location;
      if (apt.price) aptData.price = apt.price;
      if (apt.position !== 99999) aptData.position = apt.position;
      if (apt.totalCandidates !== 99999) aptData.totalCandidates = apt.totalCandidates;
      if (apt.endDate) aptData.endDate = apt.endDate;
      if (apt.imageUrl) aptData.imageUrl = apt.imageUrl;
      if (apt.specs) aptData.specs = apt.specs;
      
      await db.saveApartment(aptData);
      
      // If we have already applied (e.g. manually), update the application record
      if (apt.hasApplied) {
        await db.saveApplication({
          publicatieId: apt.publicatieId,
          position: apt.position,
          totalCandidates: apt.totalCandidates,
          status: 'APPLIED',
          appliedAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // Mark apartments that disappeared from the site as UNAVAILABLE
    const currentAptIds = apartments.map(a => a.publicatieId);
    await db.markMissingApartmentsAsUnavailable(currentAptIds);

    const availableToApply = apartments.filter(a => a.isAvailableForApply);
    console.log(`Found ${availableToApply.length} apartments we can apply for.`);

    // Sort by position (best positions first)
    availableToApply.sort((a, b) => a.position - b.position);

    // 4. Application Logic - Set and Forget
    for (const newApt of availableToApply) {
      const activeApps = await db.getActiveApplications();
      
      if (activeApps.length < MAX_ACTIVE_APPLICATIONS) {
        console.log(`We have ${activeApps.length} active applications. We can apply directly to ${newApt.publicatieId}`);
        const success = await scraper.applyToApartment(newApt.publicatieId);
        if (success) {
          await db.saveApplication({
            publicatieId: newApt.publicatieId,
            position: newApt.position !== 99999 ? newApt.position : 999, 
            totalCandidates: newApt.totalCandidates !== 99999 ? newApt.totalCandidates : 999,
            status: 'APPLIED',
            appliedAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`Successfully recorded application for ${newApt.publicatieId}`);
        }
      } else {
        console.log(`We are at the limit of ${MAX_ACTIVE_APPLICATIONS} applications. Smart swap is disabled per user request. Skipping...`);
        break; // Stop looking if we hit the limit
      }
    }

  } catch (err) {
    console.error('Error in bot cycle:', err);
  } finally {
    await scraper.close();
    console.log('--- Finished Bot Logic Cycle ---', new Date().toISOString());
  }
}

// Check if ran directly
if (process.argv[1] && process.argv[1].includes('index.ts')) {
  runLogicCycle().catch(console.error);
}

export { runLogicCycle };
