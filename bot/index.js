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
exports.runLogicCycle = runLogicCycle;
const scraper_js_1 = require("./scraper.js");
const db = __importStar(require("./db.js"));
const MAX_ACTIVE_APPLICATIONS = 2;
const WORST_POSITION_TO_CANCEL = 100;
async function runLogicCycle() {
    console.log('--- Starting Bot Logic Cycle ---', new Date().toISOString());
    const scraper = new scraper_js_1.MijnDakScraper();
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
            await db.saveApartment({
                publicatieId: apt.publicatieId,
                discoveryTime: new Date(),
                status: apt.isAvailableForApply ? 'AVAILABLE' : 'UNAVAILABLE'
            });
        }
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
                }
                else {
                    console.log(`We are at the limit of ${MAX_ACTIVE_APPLICATIONS} applications. Checking for a bad application to cancel...`);
                    const worstApp = await db.getWorstApplicationToCancel();
                    if (worstApp && worstApp.position > WORST_POSITION_TO_CANCEL) {
                        console.log(`Found bad application ${worstApp.publicatieId} (Position: ${worstApp.position}). Cancelling...`);
                        const cancelSuccess = await scraper.cancelApplication(worstApp.publicatieId);
                        if (cancelSuccess) {
                            await db.cancelApplicationDB(worstApp.publicatieId);
                            console.log(`Successfully cancelled. Now applying to new apartment ${newApt.publicatieId}...`);
                            const applySuccess = await scraper.applyToApartment(newApt.publicatieId);
                            if (applySuccess) {
                                await db.saveApplication({
                                    publicatieId: newApt.publicatieId,
                                    position: 999,
                                    totalCandidates: 999,
                                    status: 'APPLIED',
                                    appliedAt: new Date(),
                                    updatedAt: new Date()
                                });
                            }
                        }
                    }
                    else {
                        console.log('No active applications have a position > 100, or we could not find one. Keeping current applications.');
                        break; // Stop trying to apply for new ones if we can't free up a slot
                    }
                }
            }
        }
    }
    catch (err) {
        console.error('Error in bot cycle:', err);
    }
    finally {
        await scraper.close();
        console.log('--- Finished Bot Logic Cycle ---', new Date().toISOString());
    }
}
// Check if ran directly
if (require.main === module) {
    runLogicCycle();
}
