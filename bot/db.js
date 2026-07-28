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
exports.db = void 0;
exports.saveApartment = saveApartment;
exports.saveApplication = saveApplication;
exports.getActiveApplications = getActiveApplications;
exports.cancelApplicationDB = cancelApplicationDB;
exports.getWorstApplicationToCancel = getWorstApplicationToCancel;
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Initialize Firebase
const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase initialized with serviceAccountKey.json');
}
else {
    console.log('No serviceAccountKey.json found, attempting default initialization...');
    try {
        admin.initializeApp();
    }
    catch (e) {
        console.error('Failed to initialize Firebase without serviceAccountKey.json. Please generate one from Firebase Console > Project Settings > Service Accounts and save it in bot/ folder.');
        process.exit(1);
    }
}
const db = admin.firestore();
exports.db = db;
/**
 * Save or update an apartment in the database
 */
async function saveApartment(data) {
    const ref = db.collection('apartments').doc(data.publicatieId);
    await ref.set(data, { merge: true });
}
/**
 * Save or update an application
 */
async function saveApplication(data) {
    const ref = db.collection('applications').doc(data.publicatieId);
    await ref.set(data, { merge: true });
}
/**
 * Get all currently active applications (those taking up the limit of 2)
 */
async function getActiveApplications() {
    const snapshot = await db.collection('applications')
        .where('status', '==', 'APPLIED')
        .get();
    const apps = [];
    snapshot.forEach(doc => {
        apps.push(doc.data());
    });
    return apps;
}
/**
 * Cancel an application in the database
 */
async function cancelApplicationDB(publicatieId) {
    const ref = db.collection('applications').doc(publicatieId);
    await ref.update({
        status: 'CANCELLED',
        updatedAt: new Date()
    });
}
/**
 * Find the worst active application (position > 100)
 */
async function getWorstApplicationToCancel() {
    const apps = await getActiveApplications();
    if (apps.length === 0)
        return null;
    // Sort by position descending (worst first)
    apps.sort((a, b) => b.position - a.position);
    const worst = apps[0];
    if (worst.position > 100) {
        return worst;
    }
    return null;
}
