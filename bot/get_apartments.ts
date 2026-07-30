import { db } from './db.js';

async function run() {
  const snapshot = await db.collection('apartments').get();
  console.log(`Found ${snapshot.size} apartments`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`${doc.id} - ${data.status} - ${data.address} - ${data.type} - ${data.price}`);
  });
  
  const apps = await db.collection('applications').get();
  console.log(`\nFound ${apps.size} applications`);
  apps.forEach(doc => {
    const data = doc.data();
    console.log(`${doc.id} - ${data.status} - Pos: ${data.position}`);
  });
  
  process.exit(0);
}

run();
