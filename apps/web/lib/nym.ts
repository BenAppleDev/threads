import { httpsCallable } from 'firebase/functions';
import { getFirebaseClients } from './firebaseClient';

export type NymProfile = {
  nymTag: string;
  glyphBits: string;
  createdAt?: string;
};

export async function ensureNymProfile(instanceId: string): Promise<NymProfile> {
  const { functions } = getFirebaseClients();
  const callable = httpsCallable<{ instanceId: string }, NymProfile>(functions, 'ensureNymProfile');
  const result = await callable({ instanceId });
  return result.data;
}
