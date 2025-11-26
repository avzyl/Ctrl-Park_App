// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMv4ihNAEg0qweAi0EjS8HRWlJXaDY3Z8",
  authDomain: "ctrlpark-5ed79.firebaseapp.com",
  projectId: "ctrlpark-5ed79",
  storageBucket: "ctrlpark-5ed79.firebasestorage.app",
  messagingSenderId: "160671315180",
  appId: "1:160671315180:web:b449ce1d67f407ac6761c9",
  measurementId: "G-Y9WP7KPDDS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
