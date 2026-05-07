import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAbAPQJ-IxBbSPg-3XZ5d2SCMcmm-i-UNQ",
  authDomain: "flower-app-2bffe.firebaseapp.com",
  projectId: "flower-app-2bffe",
  storageBucket: "flower-app-2bffe.firebasestorage.app",
  messagingSenderId: "241953502173",
  appId: "1:241953502173:web:51101976ecd80b470fbc34"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)