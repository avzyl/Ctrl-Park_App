import { db, auth, googleProvider } from "./firebase.js";
import {
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  setDoc,
  getDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ✅ CryptoJS (global from CDN in index.html)
function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

// Allowed domain for Google login
const allowedDomain = "@mls.ceu.edu.ph";

//
// ---------- SIGN UP (Firestore Only) ----------
//
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = signupForm["fullName"].value.trim();
    const email = signupForm["email"].value.trim();
    const password = signupForm["password"].value.trim();
    const role = signupForm["role"].value;
    const plateNumber = signupForm["plateNumber"]?.value || "";
    const carPassNumber = signupForm["carPassNumber"]?.value || "";
    const termsChecked = signupForm["terms"].checked;

    if (!termsChecked) {
      Swal.fire("Error", "You must agree to the terms first.", "error");
      return;
    }

    try {
      // Use email as document ID
      const userRef = doc(db, "users", email);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        Swal.fire("Error", "This email is already registered.", "error");
        return;
      }

      // Save in Firestore with hashed password
      await setDoc(userRef, {
        fullName,
        email,
        password: hashPassword(password),
        role,
        plateNumber,
        carPassNumber,
        createdAt: serverTimestamp(),
      });

      Swal.fire("Success", "Account created successfully!", "success").then(() => {
        window.location.href = "user_app/features/system/screens/home/home.html";
      });
    } catch (error) {
      console.error("Signup error:", error);
      Swal.fire("Error", error.message, "error");
    }
  });
}

//
// ---------- SIGN IN (Firestore Only) ----------
//
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const idNumber = loginForm["idNumber"].value.trim();
    const password = loginForm["password"].value.trim();

    try {
      const userRef = doc(db, "users", idNumber);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        Swal.fire("Error", "Invalid ID or password.", "error");
        return;
      }

      const userData = docSnap.data();

      // Compare hashes
      if (userData.password !== hashPassword(password)) {
        Swal.fire("Error", "Invalid ID or password.", "error");
        return;
      }

      // Redirect based on role
      if (userData.role === "admin") {
        Swal.fire("Welcome Admin!", "Redirecting to admin panel...", "success").then(() => {
          window.location.href = "admin_app/features/system/screens/home/home.html";
        });
      } else {
        Swal.fire("Success", `Welcome back, ${userData.fullName}!`, "success").then(() => {
          window.location.href = "user_app/features/system/screens/home/home.html";
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      Swal.fire("Error", error.message, "error");
    }
  });
}

//
// ---------- GOOGLE SIGN IN (Auth + Firestore) ----------
//
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user.email.endsWith(allowedDomain)) {
        Swal.fire("Error", "You must use your CEU email (@mls.ceu.edu.ph)", "error");
        return;
      }

      // Save/update in Firestore
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          fullName: user.displayName || "",
          email: user.email,
          role: "passenger", // Google users default to passenger
          createdAt: serverTimestamp(),
        });
      }

      Swal.fire("Success", `Welcome back, ${user.displayName}!`, "success").then(() => {
        window.location.href = "user_app/features/system/screens/home/home.html";
      });
    } catch (error) {
      console.error("Google Login Error:", error);
      Swal.fire("Error", error.message, "error");
    }
  });
}
