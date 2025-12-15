import admin from 'firebase-admin';
import fs from 'fs';
import readline from 'readline';
import { FirestoreDoc } from './transform';
import { Config, Target } from './config';

function reviveTimestamps(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (/\d{4}-\d{2}-\d{2}T/.test(value)) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return admin.firestore.Timestamp.fromDate(new Date(parsed));
      }
    }
  }
  if (Array.isArray(value)) {
    return value.map((v) => reviveTimestamps(v));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      result[k] = reviveTimestamps(v);
    });
    return result;
  }
  return value;
}

export function initFirestore(target: Target): admin.firestore.Firestore {
  if (admin.apps.length === 0) {
    const options: admin.AppOptions = {};
    if (target === 'emulator') {
      process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    } else {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required for production runs');
      }
    }
    admin.initializeApp(options);
  }
  return admin.firestore();
}

export async function importDocs(docs: FirestoreDoc[], db: admin.firestore.Firestore, cfg: Config): Promise<void> {
  if (cfg.dryRun) {
    console.log(`[dry-run] Would import ${docs.length} documents`);
    return;
  }

  const batchSize = 450;
  let batch = db.batch();
  let counter = 0;

  for (const doc of docs) {
    const ref = db.doc(doc.path);
    const data = reviveTimestamps(doc.data);
    batch.set(ref, data, { merge: true });
    counter++;
    if (counter % batchSize === 0) {
      await batch.commit();
      console.log(`Committed ${counter} docs`);
      batch = db.batch();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  if (counter % batchSize !== 0) {
    await batch.commit();
    console.log(`Committed ${counter} docs total`);
  }
}

export async function readJsonl(filePath: string): Promise<FirestoreDoc[]> {
  const file = fs.createReadStream(filePath, 'utf8');
  const rl = readline.createInterface({ input: file, crlfDelay: Infinity });
  const docs: FirestoreDoc[] = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    docs.push(JSON.parse(line) as FirestoreDoc);
  }
  return docs;
}

export async function countFirestore(db: admin.firestore.Firestore): Promise<{
  rooms: number;
  messages: number;
  memberships: number;
}> {
  const [roomsSnap, messageSnap, memberSnap] = await Promise.all([
    db.collectionGroup('rooms').get(),
    db.collectionGroup('messages').get(),
    db.collectionGroup('members').get(),
  ]);

  return {
    rooms: roomsSnap.size,
    messages: messageSnap.size,
    memberships: memberSnap.size,
  };
}
