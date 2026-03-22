import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// 1. Firestore export (as it is rakhein agar data use karna hai)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 2. Auth ko Bypass karne ke liye changes:
const firebaseAuth = getAuth(app);

// Yahan hum ek mock user object bhej rahe hain
// Isse aapka app samjhega ki user pehle se logged in hai
export const auth = {
  ...firebaseAuth,
  currentUser: {
    uid: "bypass-user-id",
    displayName: "Guest User",
    email: "guest@example.com",
  },
  // Login/Logout functions ko khali (dummy) kar dein taaki error na aaye
  signInWithEmailAndPassword: () => Promise.resolve({ user: { uid: "123" } }),
  signOut: () => Promise.resolve(),
};

// Agar aapko check karna hai ki bypass kaam kar raha hai
console.log("Firebase Auth Bypassed for testing");