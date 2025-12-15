import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID || 'threads-modern';

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080', ssl: false });

async function run() {
  const instanceId = 'demo-instance';
  const roomId = 'welcome-room';
  const instanceRef = db.doc(`instances/${instanceId}`);
  await instanceRef.set({
    name: 'Demo Instance',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    settings: { cloakMode: true },
    roomsCount: 1,
  }, { merge: true });

  const roomRef = instanceRef.collection('rooms').doc(roomId);
  await roomRef.set({
    title: 'Welcome Room',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    locked: false,
    messagesCount: 0,
    ownerUid: 'seed-bot',
  }, { merge: true });

  console.log('Seeded demo instance and room');
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit());
