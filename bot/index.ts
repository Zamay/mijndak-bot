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

    // 1. Sync Reacties first to get accurate state
    console.log('Syncing current applications (Reacties)...');
    const reacties = await scraper.syncReacties();
    
    // Update DB with current Actueel apps
    for (const app of reacties.actueel) {
      await db.saveApplication({
        publicatieId: app.publicatieId,
        position: app.position,
        totalCandidates: app.totalCandidates,
        status: 'APPLIED',
        appliedAt: new Date(), // this will be updated correctly later if we already have it
        updatedAt: new Date()
      });
    }

    // Process Lopend/Historisch to mark them as SELECTED/REJECTED or similar
    // For now we just focus on Actueel to manage the limit.
    // Lopend means we are still in the running but cannot cancel it, so does it count towards the limit of 2?
    // The user said "Максимум що я можу подати - 2 заявки". This usually applies to Actueel.

    // 2. Sync Aanbod (available apartments)
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
      
      await db.saveApartment(aptData);
      
      // If we have already applied, update the application record with the position!
      if (apt.hasApplied) {
        await db.saveApplication({
          publicatieId: apt.publicatieId,
          position: apt.position,
          totalCandidates: apt.totalCandidates,
          status: 'APPLIED',
          appliedAt: new Date(), // DB helper usually uses this to create if not exists, but we can rely on it not overriding real appliedAt if implemented right
          updatedAt: new Date()
        });
      }
    }

    // Mark apartments that disappeared from the site as UNAVAILABLE
    const currentAptIds = apartments.map(a => a.publicatieId);
    await db.markMissingApartmentsAsUnavailable(currentAptIds);

    const availableToApply = apartments.filter(a => a.isAvailableForApply);
    console.log(`Found ${availableToApply.length} apartments we can apply for.`);

    // 3. Application Logic
    if (availableToApply.length > 0) {
      for (const newApt of availableToApply) {
        const activeApps = await db.getActiveApplications();
        
        if (activeApps.length < MAX_ACTIVE_APPLICATIONS) {
          console.log(`We have ${activeApps.length} active applications. We can apply directly to ${newApt.publicatieId}`);
          const success = await scraper.applyToApartment(newApt.publicatieId);
          if (success) {
            await db.saveApplication({
              publicatieId: newApt.publicatieId,
              position: 999, // Will be updated on next Reacties sync
              totalCandidates: 999,
              status: 'APPLIED',
              appliedAt: new Date(),
              updatedAt: new Date()
            });
            console.log(`Successfully recorded application for ${newApt.publicatieId}`);
          }
        } else {
          console.log(`We are at the limit of ${MAX_ACTIVE_APPLICATIONS} applications. Checking for a bad application to cancel...`);
          const worstApp = await db.getWorstApplicationToCancel();
          
          if (worstApp && worstApp.position > WORST_POSITION_TO_CANCEL) {
            
            // NEW LOGIC: Only cancel if the new apartment has a better (lower) position
            if (newApt.position < worstApp.position) {
              console.log(`Found bad application ${worstApp.publicatieId} (Pos: ${worstApp.position}). New apartment ${newApt.publicatieId} has better pos: ${newApt.position}. Cancelling...`);
              const cancelSuccess = await scraper.cancelApplication(worstApp.publicatieId);
              
              if (cancelSuccess) {
                await db.cancelApplicationDB(worstApp.publicatieId);
                console.log(`Successfully cancelled. Now applying to new apartment ${newApt.publicatieId}...`);
                
                const applySuccess = await scraper.applyToApartment(newApt.publicatieId);
                if (applySuccess) {
                  await db.saveApplication({
                    publicatieId: newApt.publicatieId,
                    position: 99999, // Will be updated on next run
                    totalCandidates: 99999,
                    status: 'APPLIED',
                    appliedAt: new Date(),
                    updatedAt: new Date()
                  });
                }
              }
            } else {
              console.log(`Worst active application ${worstApp.publicatieId} (Pos: ${worstApp.position}) is better or equal to new apartment ${newApt.publicatieId} (Pos: ${newApt.position}). Skipping...`);
              continue; // Try the next available apartment
            }
          } else {
            console.log('No active applications have a position > 100, or we could not find one. Keeping current applications.');
            break; // Stop trying to apply for new ones if we can't free up a slot (all are <= 100)
          }
        }
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
