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

// Storage wrapper - mimics the same API the app uses
export const storage = {
  async get(key) {
    try {
      const snap = await getDoc(doc(db, 'appdata', key));
      if (snap.exists()) return { value: snap.data().value };
      return null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },
  async set(key, value) {
    try {
      await setDoc(doc(db, 'appdata', key), { value, updatedAt: new Date().toISOString() });
      return { key, value };
    } catch (e) {
      console.error('Storage set error:', e);
      return null;
    }
  }
};
