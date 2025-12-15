import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();
const db = admin.firestore();

function getSalt(): string {
  return process.env.NYM_SALT || functions.config().nym?.salt || 'dev-salt';
}

function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function glyphFromHash(hash: string): string {
  // Convert first 64 bits of hash into bit string
  const bytes = Buffer.from(hash.slice(0, 16), 'hex');
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('');
}

function adjective(hash: string) {
  const words = ['aurora', 'nebula', 'stardust', 'eclipse', 'quantum', 'plasma', 'luminous', 'orbit'];
  const idx = parseInt(hash.slice(0, 2), 16) % words.length;
  return words[idx];
}

function numberTag(hash: string) {
  return (parseInt(hash.slice(2, 6), 16) % 900 + 100).toString();
}

export const ensureNymProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }

  const instanceId = data.instanceId as string;
  if (!instanceId) {
    throw new functions.https.HttpsError('invalid-argument', 'instanceId is required');
  }

  const uid = context.auth.uid;
  const userRef = db.doc(`instances/${instanceId}/users/${uid}`);
  const snapshot = await userRef.get();
  if (snapshot.exists) {
    return snapshot.data();
  }

  const salt = getSalt();
  const hash = hashString(`${instanceId}:${uid}:${salt}`);
  const nymTag = `nym:${adjective(hash)}-${numberTag(hash)}`;
  const glyphBits = glyphFromHash(hash);
  const profile = {
    nymTag,
    glyphBits,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    roles: [],
    isBanned: false,
  };

  await userRef.set(profile);
  return { nymTag, glyphBits };
});

export const onMessageCreated = functions.firestore
  .document('instances/{instanceId}/rooms/{roomId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { instanceId, roomId } = context.params;

    const preview = (data.text as string | undefined)?.slice(0, 140) ?? '';
    const roomRef = db.doc(`instances/${instanceId}/rooms/${roomId}`);
    await roomRef.set(
      {
        messagesCount: admin.firestore.FieldValue.increment(1),
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessagePreview: preview,
      },
      { merge: true }
    );
  });

export const moderationStub = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  }
  const text = (data.text as string | undefined) || '';
  const blocked = ['spam', 'banword'];
  const flagged = blocked.some((w) => text.toLowerCase().includes(w));
  return { flagged, reason: flagged ? 'Contains blocked keyword' : null };
});
