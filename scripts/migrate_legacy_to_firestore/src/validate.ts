import { Pool } from 'pg';
import { countFirestore } from './firestore';
import { loadCounts } from './postgres';
import admin from 'firebase-admin';

export async function validateCounts(pool: Pool, db: admin.firestore.Firestore): Promise<void> {
  const [pgCounts, fsCounts] = await Promise.all([loadCounts(pool), countFirestore(db)]);
  console.log('Postgres counts:', pgCounts);
  console.log('Firestore counts:', fsCounts);

  const diff = {
    rooms: fsCounts.rooms - pgCounts.rooms,
    messages: fsCounts.messages - pgCounts.messages,
    memberships: fsCounts.memberships - pgCounts.memberships,
  };
  console.log('Diff (Firestore - Postgres):', diff);
}
