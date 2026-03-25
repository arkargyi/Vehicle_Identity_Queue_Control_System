import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBwspSBz3BrSUXJPfhHMq8mlUELvzsIyd8",
  authDomain: "employee-database-7beeb.firebaseapp.com",
  projectId: "employee-database-7beeb",
  storageBucket: "employee-database-7beeb.firebasestorage.app",
  messagingSenderId: "278056418748",
  appId: "1:278056418748:web:1529074d08be77a9bb7fb9",
  measurementId: "G-DL72YY2RNX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
