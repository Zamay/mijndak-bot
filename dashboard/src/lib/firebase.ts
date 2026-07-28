import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount;

  if (serviceAccountStr) {
    try {
      serviceAccount = JSON.parse(serviceAccountStr);
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
      return null;
    }
  } else {
    // Fallback for local development
    try {
      // process.cwd() is usually the dashboard/ root when running next dev
      const localPath = path.resolve(process.cwd(), '../bot/serviceAccountKey.json');
      if (fs.existsSync(localPath)) {
        const fileContent = fs.readFileSync(localPath, 'utf-8');
        serviceAccount = JSON.parse(fileContent);
      } else {
        console.error('FIREBASE_SERVICE_ACCOUNT env is missing and ../bot/serviceAccountKey.json not found.');
        return null;
      }
    } catch (error) {
      console.error('Failed to read local serviceAccountKey.json:', error);
      return null;
    }
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    return admin.firestore();
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

export const db = initFirebaseAdmin();
