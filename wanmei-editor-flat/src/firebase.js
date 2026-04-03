// src/firebase.js
// ⬇️ 請把下方的 firebaseConfig 替換成你自己的 Firebase 設定 ⬇️
// 教學在 DEPLOY-GUIDE.md 裡面有詳細說明

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');

// Storage wrapper - uses Firebase when configured, falls back to localStorage
export const storage = {
  async get(key) {
    if (isFirebaseConfigured) {
      try {
        const snap = await getDoc(doc(db, 'appdata', key));
        if (snap.exists()) return { value: snap.data().value };
      } catch (e) {
        console.error('Storage get error (Firebase):', e);
      }
    }
    // Fallback: localStorage
    try {
      const local = localStorage.getItem(key);
      if (local) return { value: local };
    } catch {}
    return null;
  },
  async set(key, value) {
    // Always save to localStorage as backup
    try { localStorage.setItem(key, value); } catch {}
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'appdata', key), { value, updatedAt: new Date().toISOString() });
      } catch (e) {
        console.error('Storage set error (Firebase):', e);
      }
    }
    return { key, value };
  }
};
