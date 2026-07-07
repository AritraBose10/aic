import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Every consumer of `auth`/`db` is a client component reached through
// AuthProvider, but Next.js still executes client components during
// server-side prerendering. Skip real initialization there — there is no
// env config on the server build anyway — and initialize for real once
// this module runs in the browser.
let app: FirebaseApp | undefined;
let auth: Auth;
let db: Firestore;
let functions: Functions;

if (typeof window !== "undefined") {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  // Point at the local Functions emulator during `npm run dev` if it's running
  // (set NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR=true). Prod uses deployed functions.
  if (process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === "true") {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
} else {
  auth = null as unknown as Auth;
  db = null as unknown as Firestore;
  functions = null as unknown as Functions;
}

export { auth, db, functions };
export default app;
