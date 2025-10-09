// ================== IMPORTS ==================
import { db, auth, googleProvider } from "./firebase.js";
import { signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { setDoc, getDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ================== HELPERS ==================
function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

// Allowed CEU domain (for future use)
const allowedDomain = "@mls.ceu.edu.ph";

// ==================================================
// =============== GENERAL SIGN UP ==================
// ==================================================
const signupForm = document.getElementById("signup-form");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const signupBtn = signupForm.querySelector('input[type="submit"]');
    const originalText = signupBtn.value;
    signupBtn.disabled = true;
    signupBtn.value = "Signing up...";

    const fullName = signupForm["fullName"].value.trim();
    const email = signupForm["email"].value.trim();
    const password = signupForm["password"].value.trim();
    const role = signupForm["role"].value;
    const plateNumber = signupForm["plateNumber"]?.value || "";
    const carPassNumber = signupForm["carPassNumber"]?.value.trim() || "";
    const workId = signupForm["workId"]?.value.trim() || "";
    const studentNumber = signupForm["studentNumber"]?.value.trim() || "";
    const termsChecked = signupForm["terms"].checked;

    if (!termsChecked) {
      Swal.fire("Error", "You must agree to the terms first.", "error");
      signupBtn.disabled = false;
      signupBtn.value = originalText;
      return;
    }

    // Determine ID
    let idNumber;
    if (role === "admin") idNumber = workId;
    else if (role === "driver") idNumber = carPassNumber;
    else if (role === "passenger") idNumber = studentNumber;

    if (!idNumber) {
      Swal.fire(
        "Error",
        `Please provide a valid ${
          role === "admin" ? "Work ID" : role === "driver" ? "Car Pass Number" : "Student Number"
        }.`,
        "error"
      );
      signupBtn.disabled = false;
      signupBtn.value = originalText;
      return;
    }

    try {
      const userRef = doc(db, "users", idNumber);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        Swal.fire("Error", "This ID is already registered.", "error");
        signupBtn.disabled = false;
        signupBtn.value = originalText;
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
      localStorage.setItem("currentUser", JSON.stringify(userData));

      Swal.fire("Success", "Account created successfully!", "success").then(() => {
        if (role === "admin") {
          window.location.href =
            "users.html";
        } else {
          window.location.href = "user_app/features/system/screens/home/home.html";
        }
      });
    } catch (error) {
      console.error("Signup error:", error);
      Swal.fire("Error", error.message, "error");
    } finally {
      signupBtn.disabled = false;
      signupBtn.value = originalText;
    }
  });
}

// ==================================================
// ============= ADMIN-ONLY REGISTRATION =============
// ==================================================
const adminForm = document.getElementById("admin-register-form");

if (adminForm) {
  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = adminForm.querySelector('input[type="submit"]');
    const originalText = btn.value;
    btn.disabled = true;
    btn.value = "Registering...";

    const fullName = adminForm["fullName"].value.trim();
    const workId = adminForm["workId"].value.trim();
    const email = adminForm["email"].value.trim();
    const password = adminForm["password"].value.trim();
    const termsChecked = adminForm["terms"].checked;

    if (!termsChecked) {
      Swal.fire("Error", "You must agree to the terms first.", "error");
      btn.disabled = false;
      btn.value = originalText;
      return;
    }

    try {
      const userRef = doc(db, "admins", workId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        Swal.fire("Error", "This Work ID is already registered.", "error");
        btn.disabled = false;
        btn.value = originalText;
        return;
      }

      const userData = {
        fullName,
        email,
        password: hashPassword(password),
        role: "admin",
        idNumber: workId,
        photoURL: "../../main_img/default-avatar.svg",
        createdAt: serverTimestamp(),
      };

      await setDoc(userRef, userData);
      localStorage.setItem("currentUser", JSON.stringify(userData));

      Swal.fire("Success", "Admin account created successfully!", "success").then(() => {
        window.location.href =
          "users.html";
      });
    } catch (error) {
      console.error("Admin registration error:", error);
      Swal.fire("Error", error.message, "error");
    } finally {
      btn.disabled = false;
      btn.value = originalText;
    }
  });
}

// ================== SIGN IN ==================
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const loginBtn = loginForm.querySelector('input[type="submit"]');
    const originalText = loginBtn.value;
    loginBtn.disabled = true;
    loginBtn.value = "Logging in...";

    const idNumber = loginForm["idNumber"].value.trim();
    const password = loginForm["password"].value.trim();

    try {
      let userRef = doc(db, "users", idNumber);
      let docSnap = await getDoc(userRef);
      let userData = null;

      if (!docSnap.exists()) {
        // Try checking admins collection
        userRef = doc(db, "admins", idNumber);
        docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
          Swal.fire("Error", "Invalid ID or password.", "error");
          return;
        }
        userData = docSnap.data();
      } else {
        userData = docSnap.data();
      }

      // Check password
      if (userData.password !== hashPassword(password)) {
        Swal.fire("Error", "Invalid ID or password.", "error");
        return;
      }

      localStorage.setItem("currentUser", JSON.stringify(userData));

      // Redirect based on role
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
    } finally {
      loginBtn.disabled = false;
      loginBtn.value = originalText;
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
          photoURL: user.photoURL || "../../user_assets/user_img/default-avatar.svg",
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, userData);
      } else {
        userData = docSnap.data();
      }

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
        try { await signOut(auth); } catch (err) { console.warn("SignOut error:", err); }

        localStorage.removeItem("currentUser");

        Swal.fire({
          title: "Logged Out",
          text: "You have been successfully logged out.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
          willClose: () => { window.location.href = "/index.html"; }
        });
      }
    });
  });
}

// ================== INFO MODAL ==================
const infoBtn = document.getElementById("info-btn");
if (infoBtn) {
  infoBtn.addEventListener("click", (e) => {
    e.preventDefault();

    Swal.fire({
      title: "Ctrl+Park Information",
      html: `
        <div style="text-align: left;">
          <p><strong>System:</strong> Ctrl+Park Parking Monitoring System</p>
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Developed by:</strong> Shift+Dev</p>
          <p><strong>Description:</strong> This system detects and logs license plates, 
          verifies authorized users, and monitors parking activities in real time.</p>
        </div>
      `,
      icon: "info",
      confirmButtonText: "Close",
      confirmButtonColor: "#369FFF",
      width: "400px",
      backdrop: `rgba(0,0,0,0.4)`
    });
  });
}

// ================== ACCESS CONTROL (LOGIN CHECK) ==================
document.addEventListener("DOMContentLoaded", () => {
  // List of pages that need login
  const protectedPaths = [
    "/admin_app/",
    "/user_app/"
  ];

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const currentPath = window.location.pathname;

  // Check if this page is protected
  const isProtected = protectedPaths.some(path => currentPath.includes(path));

  if (isProtected && !currentUser) {
    // Not logged in, redirect to login page
    Swal.fire({
      title: "Access Denied",
      text: "You must log in first to access this page.",
      icon: "warning",
      confirmButtonText: "Go to Login"
    }).then(() => {
      window.location.href = "/index.html";
    });
  }
});
