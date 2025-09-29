// ================== IMPORTS ==================
import { db, auth, googleProvider } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
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

// ================== SIGN UP (Firestore Only) ==================
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = signupForm["fullName"].value.trim();
    const email = signupForm["email"].value.trim();
    const password = signupForm["password"].value.trim();
    const role = signupForm["role"].value;
    const plateNumber = signupForm["plateNumber"]?.value || "";
    const carPassNumber = signupForm["carPassNumber"]?.value.trim() || "";
    const workId = signupForm["workId"]?.value.trim() || "";
    const termsChecked = signupForm["terms"].checked;

    if (!termsChecked) {
      Swal.fire("Error", "You must agree to the terms first.", "error");
      return;
    }

    // ✅ Use carPassNumber for users, workId for admins
    const idNumber = role === "admin" ? workId : carPassNumber;
    if (!idNumber) {
      Swal.fire("Error", "Please provide a valid ID number.", "error");
      return;
    }

    try {
      const userRef = doc(db, "users", idNumber); // 🔑 Use ID as doc ID
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        Swal.fire("Error", "This ID is already registered.", "error");
        return;
      }

      const userData = {
        fullName,
        email,
        password: hashPassword(password),
        role,
        plateNumber,
        idNumber,
        photoURL: "../../main_img/default-avatar.svg",
        createdAt: serverTimestamp(),
      };

      await setDoc(userRef, userData);

      // Save session
      localStorage.setItem("currentUser", JSON.stringify(userData));

      // Redirect logic after signup
      Swal.fire("Success", "Account created successfully!", "success").then(() => {
        if (role === "admin") {
          window.location.href = "admin_app/features/authentication/screens/registration/registration.html"; 
        } else {
          window.location.href = "user_app/features/system/screens/home/home.html";
        }
      });
    } catch (error) {
      console.error("Signup error:", error);
      Swal.fire("Error", error.message, "error");
    }
  });
}

// ================== SIGN IN (Firestore Only) ==================
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

      // ✅ Save session
      localStorage.setItem("currentUser", JSON.stringify(userData));

      // ✅ Redirect logic
      if (userData.role === "admin") {
        Swal.fire("Welcome Admin!", "Redirecting to dashboard...", "success").then(() => {
          window.location.href = "admin_app/features/system/screens/home/dashboard.html";
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

// ================== GOOGLE SIGN IN ==================
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

      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);

      let userData;
      if (!docSnap.exists()) {
        userData = {
          uid: user.uid,
          fullName: user.displayName || "",
          email: user.email,
          role: "passenger",
          photoURL: user.photoURL || "../../main_img/default-avatar.svg",
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, userData);
      } else {
        userData = docSnap.data();
      }

      // ✅ Save session
      localStorage.setItem("currentUser", JSON.stringify(userData));

      Swal.fire("Success", `Welcome back, ${user.displayName}!`, "success").then(() => {
        window.location.href = "user_app/features/system/screens/home/home.html";
      });
    } catch (error) {
      console.error("Google Login Error:", error);
      Swal.fire("Error", error.message, "error");
    }
  });
}

// ================== LOGOUT ==================
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    Swal.fire({
      title: "Are you sure?",
      text: "You will be logged out of your account.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Logout",
      cancelButtonText: "Cancel",
      reverseButtons: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await signOut(auth);
        } catch (err) {
          console.warn("SignOut error:", err);
        }

        localStorage.removeItem("currentUser");

        Swal.fire({
          title: "Logged Out",
          text: "You have been successfully logged out.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
          willClose: () => {
            window.location.href = "/index.html";
          }
        });
      }
    });
  });
}