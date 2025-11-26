// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA23lVasQx0Ugc4vSxHxyH3lZG_W34EVtQ",
  authDomain: "ctrlpark-app-33784.firebaseapp.com",
  projectId: "ctrlpark-app-33784",
  storageBucket: "ctrlpark-app-33784.firebasestorage.app",
  messagingSenderId: "451160456141",
  appId: "1:451160456141:web:422afa308dd3a5a44e6284",
  measurementId: "G-4DZMGJP55F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
