import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import { isFirebaseConfigured, runtimeConfig } from "@/lib/config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (app) return app;
  app = initializeApp({
    apiKey: runtimeConfig.firebase.apiKey,
    authDomain: runtimeConfig.firebase.authDomain,
    projectId: runtimeConfig.firebase.projectId,
    storageBucket: runtimeConfig.firebase.storageBucket,
    messagingSenderId: runtimeConfig.firebase.messagingSenderId,
    ...(runtimeConfig.firebase.appId ? { appId: runtimeConfig.firebase.appId } : {}),
  });
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  if (auth) return auth;
  const instance = ensureApp();
  if (!instance) return null;
  auth = getAuth(instance);
  // Keep the admin session across refreshes. Fire-and-forget; failures are non-fatal.
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  return auth;
}

export function getDb(): Firestore | null {
  if (db) return db;
  const instance = ensureApp();
  if (!instance) return null;
  // Optional fields such as quality/resolution/duration are frequently
  // undefined for the other media type. Firestore rejects undefined field
  // values by default, which silently broke every save, so ignore them.
  db = initializeFirestore(instance, { ignoreUndefinedProperties: true });
  return db;
}
