// src/firebase.js
// ⬇️ 請把下方的 firebaseConfig 替換成你自己的 Firebase 設定 ⬇️
// 教學在 DEPLOY-GUIDE.md 裡面有詳細說明

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCqJb3VT-974makb1wNqNB3JuirsrBMtC8",
  authDomain: "wanmei-editor.firebaseapp.com",
  projectId: "wanmei-editor",
  storageBucket: "wanmei-editor.firebasestorage.app",
  messagingSenderId: "492419710703",
  appId: "1:492419710703:web:ccf4bae074be7a1362a51a"
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
