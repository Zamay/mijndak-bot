import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase
const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
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

  // Sort by position descending (worst first)
  apps.sort((a, b) => b.position - a.position);

  const worst = apps[0];
  if (worst.position > 100) {
    return worst;
  }
  return null;
}

export { db };
