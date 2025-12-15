import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

type FirebaseClients = {
  auth: ReturnType<typeof getAuth>;
  firestore: ReturnType<typeof getFirestore>;
  functions: ReturnType<typeof getFunctions>;
};

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

function createApp() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  return getApps().length ? getApp() : initializeApp(config);
}

export function getFirebaseClients(): FirebaseClients {
  const app = createApp();
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const functions = getFunctions(app);

  if (useEmulators) {
    const firestoreHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const [fsHost, fsPort] = firestoreHost.split(':');
    connectFirestoreEmulator(firestore, fsHost, Number(fsPort));

    const authHost = process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST || 'localhost:9099';
    connectAuthEmulator(auth, `http://${authHost}`);

    const functionsHost = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST || 'localhost:5001';
    const [fnHost, fnPort] = functionsHost.split(':');
    connectFunctionsEmulator(functions, fnHost, Number(fnPort));
  }

  return { auth, firestore, functions };
}

export async function requireAnonymousUser(): Promise<User> {
  const { auth } = getFirebaseClients();
  const currentUser = auth.currentUser;
  if (currentUser) return currentUser;
  await signInAnonymously(auth);
  return new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          resolve(user);
          unsub();
        }
      },
      reject
    );
  });
}
