import { db } from './db.js';

async function run() {
  const apps = await db.collection('applications').get();
  apps.forEach(doc => {
    console.log(`App ${doc.id}: ${JSON.stringify(doc.data())}`);
  });
  
  for (const doc of apps.docs) {
     const apt = await db.collection('apartments').doc(doc.id).get();
     if (apt.exists) {
        console.log(`Apt ${doc.id}: ${JSON.stringify(apt.data())}`);
     } else {
        console.log(`Apt ${doc.id}: MISSING!`);
     }
  }
  process.exit(0);
}
run();
