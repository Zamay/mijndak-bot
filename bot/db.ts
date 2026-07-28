import admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath) && !admin.apps.length) {
  const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf-8');
  const serviceAccount = JSON.parse(serviceAccountContent);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase initialized with serviceAccountKey.json');
} else {
  console.log('No serviceAccountKey.json found, attempting default initialization...');
  try {
    admin.initializeApp();
  } catch (e) {
    console.error('Failed to initialize Firebase without serviceAccountKey.json. Please generate one from Firebase Console > Project Settings > Service Accounts and save it in bot/ folder.');
    process.exit(1);
  }
}

const db = admin.firestore();

export interface ApartmentData {
  publicatieId: string;
  address?: string;
  price?: string;
  rooms?: string;
  area?: string;
  type?: string;
  discoveryTime: Date;
  status: 'AVAILABLE' | 'UNAVAILABLE';
}

export interface ApplicationData {
  publicatieId: string;
  apartmentRef?: string;
  position: number;
  totalCandidates: number;
  status: 'APPLIED' | 'CANCELLED' | 'SELECTED' | 'REJECTED';
  appliedAt: Date;
  updatedAt: Date;
}

/**
 * Save or update an apartment in the database
 */
export async function saveApartment(data: ApartmentData) {
  const ref = db.collection('apartments').doc(data.publicatieId);
  await ref.set(data, { merge: true });
}

/**
 * Save or update an application
 */
export async function saveApplication(data: ApplicationData) {
  const ref = db.collection('applications').doc(data.publicatieId);
  await ref.set(data, { merge: true });
}

/**
 * Get all currently active applications (those taking up the limit of 2)
 */
export async function getActiveApplications(): Promise<ApplicationData[]> {
  const snapshot = await db.collection('applications')
    .where('status', '==', 'APPLIED')
    .get();
  
  const apps: ApplicationData[] = [];
  snapshot.forEach(doc => {
    apps.push(doc.data() as ApplicationData);
  });
  return apps;
}

/**
 * Cancel an application in the database
 */
export async function cancelApplicationDB(publicatieId: string) {
  const ref = db.collection('applications').doc(publicatieId);
  await ref.update({
    status: 'CANCELLED',
    updatedAt: new Date()
  });
}

/**
 * Find the worst active application (position > 100)
 */
export async function getWorstApplicationToCancel(): Promise<ApplicationData | null> {
  const apps = await getActiveApplications();
  if (apps.length === 0) return null;

  // Filter out the ones with position 999 so we don't instantly cancel new apps
  const validApps = apps.filter(a => a.position !== 999);
  if (validApps.length === 0) return null;

  // Sort by position descending (worst first)
  validApps.sort((a, b) => b.position - a.position);

  const worst = validApps[0];
  if (worst && worst.position > 100) {
    return worst;
  }
  return null;
}

/**
 * Mark apartments as unavailable if they are no longer on the site
 */
export async function markMissingApartmentsAsUnavailable(currentIds: string[]) {
  const snapshot = await db.collection('apartments')
    .where('status', '==', 'AVAILABLE')
    .get();
  
  const batch = db.batch();
  let count = 0;
  
  snapshot.forEach(doc => {
    if (!currentIds.includes(doc.id)) {
      batch.update(doc.ref, { status: 'UNAVAILABLE' });
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Marked ${count} apartments as UNAVAILABLE.`);
  }
}

export { db };
