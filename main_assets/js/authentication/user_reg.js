// ================== IMPORTS ==================
import { db, auth, googleProvider } from "./firebase.js";
import { signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  setDoc,
  getDoc,
  doc,
  serverTimestamp,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ================== LOG HISTORY TRACKING ==================
// MOVE THIS TO THE TOP (around line 15)
async function addToLogHistory(userId, userEmail, userName, userRole, action, details = {}) {
    try {
        const logRef = doc(db, "log_history", `${userId}_${action}_${Date.now()}`);
        await setDoc(logRef, {
            userId: userId,
            userEmail: userEmail,
            userName: userName,
            userRole: userRole,
            action: action,
            timestamp: serverTimestamp(),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            userAgent: navigator.userAgent,
            ...details
        });
        console.log(`${action} logged successfully`);
    } catch (err) {
        console.error("Error logging to history:", err);
    }
}

function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

// ================== INACTIVITY LOGOUT TRACKING ==================
let inactivityTimer = null;

// Change from 1 hour to 1 minute for testing
//const INACTIVITY_LIMIT = 10 * 1000; // 1 minute (60,000 milliseconds)
const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour in milliseconds

// Check if user has an active parking session
function hasActiveParkingSession() {
    try {
        const parkedSlot = localStorage.getItem("parkedSlot");
        const currentHistoryId = localStorage.getItem("currentHistoryId");
        const parkedAt = localStorage.getItem("parkedAt");
        
        // If they have a parked slot AND history ID AND it's been less than 24 hours (valid session)
        if (parkedSlot && currentHistoryId && parkedAt) {
            const parkedTime = new Date(parkedAt).getTime();
            const now = Date.now();
            const hoursParked = (now - parkedTime) / (1000 * 60 * 60);
            
            // Session is valid if parked within last 24 hours
            if (hoursParked < 24) {
                console.log("User has active parking session - skip auto-logout");
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error("Error checking parking session:", err);
        return false;
    }
}

// Reset inactivity timer
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) return;
    
    const userData = JSON.parse(currentUser);
    
    // ONLY apply to drivers and passengers (skip admins)
    if (userData.role !== "driver" && userData.role !== "passenger") {
        console.log(`${userData.role} logged in - inactivity logout disabled`);
        return;
    }
    
    if (hasActiveParkingSession()) {
        console.log("Active parking session detected - inactivity logout disabled");
        return;
    }
    
    // Set new timer for 1 hour
    inactivityTimer = setTimeout(async () => {
        console.log("1 hour of inactivity detected - logging out...");
        
        // Double-check parking session one more time before logging out
        if (hasActiveParkingSession()) {
            console.log("Parking session still active - aborting auto-logout");
            resetInactivityTimer(); // Restart timer
            return;
        }
        
        // Show warning and logout
        Swal.fire({
            title: "Session Expired",
            text: "You have been inactive for 1 hour. Please login again to continue.",
            icon: "warning",
            timer: 3000,
            showConfirmButton: true,
            confirmButtonText: "OK"
        }).then(async () => {
            // Perform logout
            try {
                await signOut(auth);
            } catch (err) {
                console.warn("SignOut error:", err);
            }
            
            const user = JSON.parse(localStorage.getItem("currentUser"));
            if (user && typeof addToLogHistory === 'function') {
                await addToLogHistory(user.idNumber, user.email, user.fullName, user.role, "auto-logout-inactivity");
            }
            
            localStorage.removeItem("currentUser");
            window.location.href = "/index.html";
        });
    }, INACTIVITY_LIMIT);
    
    console.log("Inactivity timer reset - will logout after 1 hour of no activity");
}

// Track user activity
function trackUserActivity() {
    if (!localStorage.getItem("currentUser")) return;
    
    // Only reset timer if no active parking session
    if (!hasActiveParkingSession()) {
        resetInactivityTimer();
    }
}

// Set up activity event listeners
function setupActivityTracking() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
    
    events.forEach(event => {
        document.addEventListener(event, trackUserActivity);
    });
    
    // Also track when user interacts with map
    const mapElement = document.getElementById("map");
    if (mapElement) {
        mapElement.addEventListener('click', trackUserActivity);
        mapElement.addEventListener('dragstart', trackUserActivity);
        mapElement.addEventListener('zoomend', trackUserActivity);
    }
    
    // Initial timer start if user is logged in
    if (localStorage.getItem("currentUser") && !hasActiveParkingSession()) {
        resetInactivityTimer();
    }
}

// Call this after login success
function startInactivityTracking() {
    setupActivityTracking();
}

// Check parking session status periodically (every minute)
function monitorParkingSession() {
    setInterval(() => {
        if (localStorage.getItem("currentUser")) {
            if (hasActiveParkingSession()) {
                console.log("Active parking session detected - inactivity logout suspended");
                // Clear timer if exists
                if (inactivityTimer) {
                    clearTimeout(inactivityTimer);
                    inactivityTimer = null;
                }
            } else {
                // No parking session - make sure timer is running
                if (!inactivityTimer && localStorage.getItem("currentUser")) {
                    resetInactivityTimer();
                }
            }
        }
    }, 60000); // Check every minute
}

// ================== LOGIN TRACKING FUNCTION ==================
async function trackLogin(userId, collectionName, userData) {
    try {
        const loginLogRef = doc(db, "user_logs", `${userId}_${Date.now()}`);
        await setDoc(loginLogRef, {
            userId: userId,
            userEmail: userData.email,
            userName: userData.fullName,
            userRole: userData.role,
            loginTime: serverTimestamp(),
            loginDate: new Date().toISOString().split('T')[0],
            userAgent: navigator.userAgent
        });
        
        const userRef = doc(db, collectionName, userId);
        await updateDoc(userRef, {
            lastLoginAt: serverTimestamp(),
            lastActiveDate: serverTimestamp()
        });
        
        console.log("Login tracked successfully");
    } catch (err) {
        console.error("Error tracking login:", err);
    }
}

// ================== AUTO-DEACTIVATE OLD ACCOUNTS ==================
async function autoDeactivateOldAccounts() {
    const fourMonthsInMs = 4 * 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        
        for (const docSnap of usersSnapshot.docs) {
            const user = docSnap.data();
            if (user.status === "deactivated" || user.status === "inactive") continue;
            if (user.reg_status === "pending") continue;
            
            // Skip recently reactivated users (last 7 days)
            const reactivatedAt = user.reactivatedAt?.toMillis ? user.reactivatedAt.toMillis() : null;
            if (reactivatedAt && (now - reactivatedAt) < 7 * 24 * 60 * 60 * 1000) {
                console.log(`Skipping recently reactivated user: ${user.idNumber}`);
                continue;
            }
            
            const lastLoginAt = user.lastLoginAt?.toMillis ? user.lastLoginAt.toMillis() : null;
            const createdAt = user.createdAt?.toMillis ? user.createdAt.toMillis() : null;
            const lastActive = lastLoginAt || createdAt;
            
            if (lastActive && (now - lastActive) >= fourMonthsInMs) {
                await updateDoc(docSnap.ref, {
                    status: "deactivated",
                    deactivatedAt: serverTimestamp(),
                    deactivatedReason: "4 months of inactivity"
                });
                console.log(`User ${user.idNumber} auto-deactivated due to 4 months inactivity`);
            }
        }
        
        // Same for admins...
        const adminsRef = collection(db, "admins");
        const adminsSnapshot = await getDocs(adminsRef);
        
        for (const docSnap of adminsSnapshot.docs) {
            const admin = docSnap.data();
            if (admin.status === "deactivated" || admin.status === "inactive") continue;
            if (admin.reg_status === "pending") continue;
            
            const reactivatedAt = admin.reactivatedAt?.toMillis ? admin.reactivatedAt.toMillis() : null;
            if (reactivatedAt && (now - reactivatedAt) < 7 * 24 * 60 * 60 * 1000) {
                console.log(`Skipping recently reactivated admin: ${admin.idNumber}`);
                continue;
            }
            
            const lastLoginAt = admin.lastLoginAt?.toMillis ? admin.lastLoginAt.toMillis() : null;
            const createdAt = admin.createdAt?.toMillis ? admin.createdAt.toMillis() : null;
            const lastActive = lastLoginAt || createdAt;
            
            if (lastActive && (now - lastActive) >= fourMonthsInMs) {
                await updateDoc(docSnap.ref, {
                    status: "deactivated",
                    deactivatedAt: serverTimestamp(),
                    deactivatedReason: "4 months of inactivity"
                });
                console.log(`Admin ${admin.idNumber} auto-deactivated due to 4 months inactivity`);
            }
        }
    } catch (err) {
        console.error("Error auto-deactivating accounts:", err);
    }
}

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

    const emailRegex = /^[a-zA-Z0-9._%+-]+@mls\.ceu\.edu\.ph$/;
    if (!emailRegex.test(email)) {
      Swal.fire("Error", "Please use an email address with the domain @mls.ceu.edu.ph", "error");
      signupBtn.disabled = false;
      signupBtn.value = originalText;
      return;
    }

    if (!termsChecked) {
      Swal.fire("Error", "You must agree to the terms first.", "error");
      signupBtn.disabled = false;
      signupBtn.value = originalText;
      return;
    }

    let idNumber;
    if (role === "admin") idNumber = workId;
    else if (role === "driver") idNumber = carPassNumber;
    else if (role === "passenger") idNumber = studentNumber;

    if (!idNumber) {
      Swal.fire("Error", `Please provide a valid ${role === "admin" ? "Work ID" : role === "driver" ? "Car Pass Number" : "Student Number"}.`, "error");
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
        photoURL: "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
        createdAt: serverTimestamp(),
        status: "active",
        reg_status: "approved"
      };

      await setDoc(userRef, userData);
      localStorage.setItem("currentUser", JSON.stringify(userData));
      await addToLogHistory(idNumber, userData.email, userData.fullName, userData.role, "login");

      Swal.fire("Success", "Account created successfully!", "success").then(() => {
        if (role === "admin") window.location.href = "users.html";
        else window.location.href = "user_app/features/system/screens/home/home.html";
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
    const adminType = adminForm["adminType"] ? adminForm["adminType"].value : "admin";
    const termsChecked = adminForm["terms"].checked;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@mls\.ceu\.edu\.ph$/;
    if (!emailRegex.test(email)) {
      Swal.fire("Error", "Please use an email address with the domain @mls.ceu.edu.ph", "error");
      btn.disabled = false;
      btn.value = originalText;
      return;
    }

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
        adminType: adminType,
        idNumber: workId,
        photoURL: "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
        createdAt: serverTimestamp(),
        reg_status: "pending",
        status: "inactive"
      };

      await setDoc(userRef, userData);
      
      const modal = document.getElementById("registerAdminModal");
      if (modal) modal.classList.remove("active");
      adminForm.reset();

      Swal.fire("Success", "Admin account created successfully! Waiting for approval.", "success");
    } catch (error) {
      console.error("Admin registration error:", error);
      Swal.fire("Error", error.message, "error");
    } finally {
      btn.disabled = false;
      btn.value = originalText;
    }
  });
}

// ================== SIGN IN WITH REMEMBER ME ==================
const rememberToggle = document.getElementById("rememberToggle");
const rememberIcon = document.getElementById("rememberIcon");
const idNumberInput = document.getElementById("idNumber");

let rememberActive = false;

window.addEventListener("DOMContentLoaded", () => {
  const savedId = localStorage.getItem("rememberedId");
  const rememberStatus = localStorage.getItem("rememberStatus");

  if (rememberStatus === "true" && savedId && idNumberInput) {
    idNumberInput.value = savedId;
    rememberActive = true;
    if (rememberIcon) rememberIcon.classList.replace("fa-square", "fa-square-check");
  }
});

if (rememberToggle) {
  rememberToggle.addEventListener("click", () => {
    rememberActive = !rememberActive;
    if (rememberIcon) {
      rememberIcon.classList.toggle("fa-square");
      rememberIcon.classList.toggle("fa-square-check");
    }
    localStorage.setItem("rememberStatus", rememberActive);
  });
}

// =============== LOGIN WITH AUTO-DEACTIVATION CHECK ===============
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
      let collectionName = "users";

      if (!docSnap.exists()) {
        userRef = doc(db, "admins", idNumber);
        docSnap = await getDoc(userRef);
        collectionName = "admins";
        if (!docSnap.exists()) {
          Swal.fire("Error", "Invalid ID or password.", "error");
          loginBtn.disabled = false;
          loginBtn.value = originalText;
          return;
        }
        userData = docSnap.data();
      } else {
        userData = docSnap.data();
      }

      // Check account status
      if (userData.status === "deactivated") {
          Swal.fire({
              title: "Account Deactivated",
              html: "Your account has been deactivated due to 4 months of inactivity.<br><br>Please contact the administrator to reactivate your account.",
              icon: "warning",
              confirmButtonText: "OK"
          });
          loginBtn.disabled = false;
          loginBtn.value = originalText;
          return;
      }

      // Allow "active" status only - NOT "inactive"
      if (userData.status === "inactive") {
          Swal.fire("Error", "Your account is inactive. Please contact support.", "error");
          loginBtn.disabled = false;
          loginBtn.value = originalText;
          return;
      }

      // Check for pending approval - but allow if reg_status is "approved"
      if (userData.reg_status === "pending") {
          Swal.fire("Error", "Your account is pending approval. Please wait for admin approval.", "error");
          loginBtn.disabled = false;
          loginBtn.value = originalText;
          return;
      }

      // ADD THIS CHECK - If status is "active" but reg_status is not "approved", fix it
      if (userData.status === "active" && userData.reg_status !== "approved") {
          console.log("Auto-fixing reg_status to approved for reactivated user");
          await updateDoc(userRef, {
              reg_status: "approved"
          });
          userData.reg_status = "approved";
      }

      if (userData.password !== hashPassword(password)) {
        Swal.fire("Error", "Invalid ID or password.", "error");
        loginBtn.disabled = false;
        loginBtn.value = originalText;
        return;
      }

      // Check for 4 months inactivity
      const lastLoginAt = userData.lastLoginAt?.toMillis ? userData.lastLoginAt.toMillis() : null;
      const createdAt = userData.createdAt?.toMillis ? userData.createdAt.toMillis() : null;
      const reactivatedAt = userData.reactivatedAt?.toMillis ? userData.reactivatedAt.toMillis() : null;
      const lastActive = lastLoginAt || createdAt;
      const fourMonthsInMs = 4 * 30 * 24 * 60 * 60 * 1000;

      // If user was reactivated within the last 7 days, skip the inactivity check
      const wasRecentlyReactivated = reactivatedAt && (Date.now() - reactivatedAt) < 7 * 24 * 60 * 60 * 1000;

      if (!wasRecentlyReactivated && lastActive && (Date.now() - lastActive) >= fourMonthsInMs) {
          await updateDoc(userRef, {
              status: "deactivated",
              deactivatedAt: serverTimestamp(),
              deactivatedReason: "4 months of inactivity"
          });
          
          Swal.fire({
              title: "Account Deactivated",
              html: "Your account has been deactivated because you haven't logged in for 4 months.<br><br>Please contact the administrator to reactivate your account.",
              icon: "warning",
              confirmButtonText: "OK"
          });
          loginBtn.disabled = false;
          loginBtn.value = originalText;
          return;
      }

      // If user was reactivated, update lastLoginAt now so they won't get deactivated again
      if (reactivatedAt && !lastLoginAt) {
          console.log("User was reactivated - updating lastLoginAt to prevent auto-deactivation");
          await updateDoc(userRef, {
              lastLoginAt: serverTimestamp()
          });
      }

      if (rememberActive) {
        localStorage.setItem("rememberedId", idNumber);
      } else {
        localStorage.removeItem("rememberedId");
        localStorage.removeItem("rememberStatus");
      }

      localStorage.setItem("currentUser", JSON.stringify(userData));
      startInactivityTracking();
      monitorParkingSession();
      await addToLogHistory(idNumber, userData.email, userData.fullName, userData.role, "login");
      
      await trackLogin(idNumber, collectionName, userData);

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

// Run auto-deactivation when login page loads
if (document.getElementById("login-form")) {
    autoDeactivateOldAccounts();
    setInterval(autoDeactivateOldAccounts, 24 * 60 * 60 * 1000);
}

// ================== GOOGLE SIGN IN ==================
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user.email.endsWith("@mls.ceu.edu.ph")) {
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
          photoURL: user.photoURL || "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
          createdAt: serverTimestamp(),
          status: "active",
          reg_status: "approved"
        };
        await setDoc(userRef, userData);
      } else {
        userData = docSnap.data();
      }

      localStorage.setItem("currentUser", JSON.stringify(userData));
      await addToLogHistory(idNumber, userData.email, userData.fullName, userData.role, "login");

      Swal.fire("Success", `Welcome back, ${user.displayName}!`, "success").then(() => {
        window.location.href = "user_app/features/system/screens/home/home.html";
      });
    } catch (error) {
      console.error("Google Login Error:", error);
      Swal.fire("Error", error.message, "error");
    }
  });
}

// ================== FORGOT PASSWORD ===============
const resetLinkBtn = document.getElementById("reset");

if (resetLinkBtn) {
  resetLinkBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const { value: email } = await Swal.fire({
      title: "Forgot Password?",
      input: "email",
      inputLabel: "Enter your registered email",
      inputPlaceholder: "yourname@mls.ceu.edu.ph",
      showCancelButton: true,
      confirmButtonText: "Send Reset Link",
    });

    if (!email) return;

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Swal.fire("Error", "No account found with that email.", "error");
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;
      const token = Math.random().toString(36).substring(2, 15);
      const expiry = Date.now() + 1000 * 60 * 15;

      await updateDoc(userDoc.ref, { resetToken: token, resetExpires: expiry });

      const resetLink = `https://avzyl.github.io/Ctrl-Park_App/reset_password.html?token=${token}&id=${userId}`;

      Swal.fire("Email Sent!", "Please check your email for the reset link.", "success");
    } catch (error) {
      console.error("Password reset error:", error);
      Swal.fire("Error", "An error occurred while sending the reset link.", "error");
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
        
        // Get current user BEFORE removing from localStorage
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (currentUser) {
            await addToLogHistory(currentUser.idNumber, currentUser.email, currentUser.fullName, currentUser.role, "logout");
        }
        
        localStorage.removeItem("currentUser");
        
        Swal.fire({ 
          title: "Logged Out", 
          text: "You have been successfully logged out.", 
          icon: "success", 
          timer: 2000, 
          showConfirmButton: false, 
          willClose: () => { 
            window.location.href = "https://avzyl.github.io/Ctrl-Park_App/"; 
          } 
        });
      }
    });
  });
}

// ========================= SLOTS ======================= //
document.addEventListener("DOMContentLoaded", () => {
  const parkingCountEl = document.getElementById("parking-count");
  const slotsRef = collection(db, "slots");

  onSnapshot(slotsRef, (snapshot) => {
    let totalSlots = 0;
    let availableSlots = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalSlots++;

      // Count as available if it's NOT occupied
      if (data.status !== "Occupied") {
        availableSlots++;
      }
    });

    const occupiedSlots = totalSlots - availableSlots;

    parkingCountEl.innerHTML = `
          Available: <span style="color: green;">${availableSlots}</span> 
          — Occupied: ${occupiedSlots}
      `;
  });
});


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

// ================== LOAD PROFILE DATA ==================
document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser) return;

  // Reference to Firestore document
  const userRef = doc(db, "users", currentUser.idNumber);
  const docSnap = await getDoc(userRef);

  if (docSnap.exists()) {
    const latestData = docSnap.data();

    // Update localStorage with latest Firestore data
    localStorage.setItem("currentUser", JSON.stringify(latestData));

    // Update profile picture
    const userPhoto = document.getElementById("user-photo");
    userPhoto.src = latestData.photoURL || "../../../../user_assets/user_img/default-avatar.svg";

    // Update user info in the page
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || "-";
    };

    function setTextFromFirestoreDate(elementId, timestamp) {
      const el = document.getElementById(elementId);
      if (!el) return;

      if (timestamp?.toDate) {
        const date = timestamp.toDate();
        el.textContent = date.toLocaleString("en-PH", {
          dateStyle: "long",
          timeStyle: "short",
        });
      } else {
        el.textContent = "Not available";
      }
    }
    setTextFromFirestoreDate("user-joinedDate", latestData.createdAt);


    setText("user-status", latestData.status);
    setText("user-name", latestData.fullName);
    setText("user-email", latestData.email);
    setText("user-idNumber", latestData.idNumber);
    setText("user-plateNumber", latestData.plateNumber);
    const capitalizeFirst = (text) => {
      if (!text) return "-";
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    };

    setText("user-role", capitalizeFirst(latestData.role));

    setText("user-department", latestData.department);
    setText("user-program", latestData.program);
    setText("user-studentNo", latestData.studentNo);
    setText("user-address", latestData.address);

    // Format phone number with +63 prefix
    const formatPhone = (num) => {
      if (!num) return "-";
      // Remove any existing +63 or 0 prefix for consistency
      let clean = num.toString().replace(/^(\+63|0)/, "");
      return `+63${clean}`;
    };

    setText("user-telephoneNo", formatPhone(latestData.telephoneNo));

    setText("user-vehicle", latestData.vehicle);

  } else {
    console.log("No user data found in Firestore.");
  }
});

// === CLOUDINARY CONFIG ===
const CLOUD_NAME = "doy8exjvc";
const UPLOAD_PRESET = "ctrlpark_uploads";

document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser) return;

  const userPhoto = document.getElementById("user-photo");
  const uploadInput = document.getElementById("profile-upload");

  // Load current photo or fallback
  userPhoto.src =
    currentUser.photoURL || "../../../../user_assets/user_img/default-avatar.svg";

  // When a file is selected
  uploadInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      const previewSrc = e.target.result;

      // Show SweetAlert preview
      const confirm = await Swal.fire({
        title: "Change Profile Picture?",
        html: `
          <img src="${previewSrc}" alt="Preview"
            style="width: 150px; height: 150px; border-radius: 50%; border: 2px solid #2e7bc4; object-fit: cover; margin-bottom: 10px;">
          <p>Do you want to upload this picture?</p>
        `,
        showCancelButton: true,
        confirmButtonText: "Yes, upload it",
        cancelButtonText: "Cancel",
      });

      if (!confirm.isConfirmed) return;

      Swal.fire({
        title: "Uploading...",
        text: "Please wait while we update your profile picture.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", "ctrlpark_uploads/profile_pictures");

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!data.secure_url) throw new Error("Upload failed");

        // Update Firestore
        const userRef = doc(
          db,
          currentUser.role === "admin" ? "admins" : "users",
          currentUser.idNumber
        );
        await setDoc(userRef, { photoURL: data.secure_url }, { merge: true });

        // Update localStorage and UI
        currentUser.photoURL = data.secure_url;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        userPhoto.src = data.secure_url;

        Swal.fire({
          icon: "success",
          title: "Profile Updated!",
          text: "Your new profile picture has been uploaded.",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (err) {
        console.error("Error uploading image:", err);
        Swal.fire("Error", "Failed to upload image. Please try again.", "error");
      }
    };

    reader.readAsDataURL(file);
  });
});

// ================== EDIT USER DATA WITH APPROVAL SYSTEM ==================

document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.getElementById("edit-btn");
  const saveBtn = document.getElementById("save-btn");
  const cancelBtn = document.getElementById("cancel-btn");

  // Fields that can be edited directly (no approval needed)
  const directEditFields = {
    "user-name": "fullName",
    "user-email": "email",
    "user-address": "address",
    "user-telephoneNo": "telephoneNo",
    "user-department": "department",
    "user-program": "program",
  };

  // Fields that require admin approval
  const approvalRequiredFields = {
    "user-plateNumber": "plateNumber",
    "user-vehicle": "vehicle"
  };

  let originalData = {};
  let originalApprovalData = {};

  // Hide save/cancel at start
  if (saveBtn) saveBtn.classList.add("hidden");
  if (cancelBtn) cancelBtn.classList.add("hidden");

  // === EDIT MODE ===
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      originalData = {};
      originalApprovalData = {};

      // Handle direct edit fields (become input fields)
      Object.keys(directEditFields).forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          originalData[id] = el.textContent.trim();
          const input = document.createElement("input");
          input.type = "text";
          input.className = "editable";
          input.id = id;
          input.value = el.textContent.trim();
          el.replaceWith(input);
        }
      });

      // Handle approval-required fields (show with indicator that they need approval)
      Object.keys(approvalRequiredFields).forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          originalApprovalData[id] = el.textContent.trim();
          
          // Create wrapper div for visual feedback
          const wrapper = document.createElement("div");
          wrapper.className = "approval-field-wrapper";
          wrapper.style.position = "relative";
          
          const input = document.createElement("input");
          input.type = "text";
          input.className = "editable approval-required";
          input.id = id;
          input.value = el.textContent.trim();
          input.style.borderRight = "2px solid #ff9800";
          
          const badge = document.createElement("span");
          badge.textContent = "⚠️ Requires Admin Approval";
          badge.style.cssText = "font-size: 10px; color: #ff9800; margin-left: 10px;";
          
          wrapper.appendChild(input);
          wrapper.appendChild(badge);
          el.replaceWith(wrapper);
        }
      });

      if (editBtn) editBtn.classList.add("hidden");
      if (saveBtn) saveBtn.classList.remove("hidden");
      if (cancelBtn) cancelBtn.classList.remove("hidden");
    });
  }

  // === CANCEL EDIT ===
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      // Restore direct edit fields
      Object.keys(directEditFields).forEach((id) => {
        const wrapper = document.getElementById(id);
        if (wrapper && wrapper.tagName === "INPUT") {
          const h4 = document.createElement("h4");
          h4.id = id;
          h4.textContent = originalData[id];
          wrapper.replaceWith(h4);
        }
      });

      // Restore approval-required fields
      Object.keys(approvalRequiredFields).forEach((id) => {
        const wrapper = document.getElementById(id);
        if (wrapper && wrapper.parentElement?.classList?.contains("approval-field-wrapper")) {
          const h4 = document.createElement("h4");
          h4.id = id;
          h4.textContent = originalApprovalData[id];
          wrapper.parentElement.replaceWith(h4);
        } else {
          const el = document.getElementById(id);
          if (el && el.tagName === "INPUT") {
            const h4 = document.createElement("h4");
            h4.id = id;
            h4.textContent = originalApprovalData[id];
            el.replaceWith(h4);
          }
        }
      });

      if (editBtn) editBtn.classList.remove("hidden");
      if (saveBtn) saveBtn.classList.add("hidden");
      if (cancelBtn) cancelBtn.classList.add("hidden");
    });
  }

  // === SUBMIT APPROVAL REQUEST FOR PLATE NUMBER & VEHICLE ===
  async function submitApprovalRequest(userId, collectionName, editData) {
    try {
      const pendingRef = doc(db, "pending_edits", `${userId}_${Date.now()}`);
      await setDoc(pendingRef, {
        userId: userId,
        collectionName: collectionName,
        userRole: "driver", // or passenger
        requestedBy: JSON.parse(localStorage.getItem("currentUser"))?.fullName || "User",
        requestedAt: serverTimestamp(),
        status: "pending",
        editData: editData,
        requestType: "profile_update"
      });
      
      return true;
    } catch (err) {
      console.error("Error submitting approval request:", err);
      return false;
    }
  }

  // === SAVE CHANGES ===
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      // Collect direct edit changes
      const directUpdatedData = {};
      Object.keys(directEditFields).forEach((id) => {
        const input = document.getElementById(id);
        if (input && input.tagName === "INPUT") {
          directUpdatedData[directEditFields[id]] = input.value.trim();
          
          // Restore to display mode immediately
          const h4 = document.createElement("h4");
          h4.id = id;
          h4.textContent = input.value.trim();
          input.replaceWith(h4);
        }
      });

      // Collect approval-required changes
      const approvalUpdatedData = {};
      Object.keys(approvalRequiredFields).forEach((id) => {
        // Find the input (might be inside wrapper)
        let input = document.getElementById(id);
        if (!input) {
          const wrapper = document.querySelector(`#${id}`)?.parentElement;
          if (wrapper?.classList?.contains("approval-field-wrapper")) {
            input = wrapper.querySelector(`#${id}`);
          }
        }
        
        if (input && input.tagName === "INPUT") {
          const newValue = input.value.trim();
          const oldValue = originalApprovalData[id];
          
          if (newValue !== oldValue && newValue !== "") {
            approvalUpdatedData[approvalRequiredFields[id]] = newValue;
          }
          
          // Restore to display mode
          const h4 = document.createElement("h4");
          h4.id = id;
          h4.textContent = oldValue;
          if (input.parentElement?.classList?.contains("approval-field-wrapper")) {
            input.parentElement.replaceWith(h4);
          } else {
            input.replaceWith(h4);
          }
        } else {
          // Restore original if no input found
          const h4 = document.createElement("h4");
          h4.id = id;
          h4.textContent = originalApprovalData[id];
          const existingEl = document.getElementById(id);
          if (existingEl) existingEl.replaceWith(h4);
        }
      });

      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        const userId = currentUser?.idNumber;
        const userRole = currentUser?.role;

        if (!userId) throw new Error("User ID not found in localStorage.");

        // Determine collection
        const collectionName = userRole === "admin" ? "admins" : "users";
        const userRef = doc(db, collectionName, userId);

        // 1. Save direct edits immediately
        if (Object.keys(directUpdatedData).length > 0) {
          await updateDoc(userRef, {
            ...directUpdatedData,
            updatedAt: serverTimestamp()
          });

          // Update localStorage
          const newUserData = { ...currentUser, ...directUpdatedData };
          localStorage.setItem("currentUser", JSON.stringify(newUserData));
        }

        // 2. Submit approval request for plate number and/or vehicle
        if (Object.keys(approvalUpdatedData).length > 0) {
          const success = await submitApprovalRequest(userId, collectionName, approvalUpdatedData);
          
          if (success) {
            Swal.fire({
              icon: "info",
              title: "Changes Submitted for Approval",
              html: "Your changes to <strong>Plate Number</strong> and/or <strong>Vehicle</strong> have been submitted for admin approval.<br><br>You will see the changes once approved.",
              timer: 3000,
              showConfirmButton: true
            });
          } else {
            throw new Error("Failed to submit approval request");
          }
        } else if (Object.keys(directUpdatedData).length > 0) {
          // Only direct changes were made
          Swal.fire({
            icon: "success",
            title: "Profile Updated",
            text: "Your profile has been updated successfully.",
            timer: 2000,
            showConfirmButton: false
          });
        } else if (Object.keys(approvalUpdatedData).length === 0 && Object.keys(directUpdatedData).length === 0) {
          Swal.fire({
            icon: "info",
            title: "No Changes",
            text: "No changes were made to your profile.",
            timer: 1500,
            showConfirmButton: false
          });
        }

      } catch (error) {
        console.error("Error updating profile:", error);
        Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: error.message || "An error occurred while saving your changes.",
        });
      }

      // Reset UI
      if (editBtn) editBtn.classList.remove("hidden");
      if (saveBtn) saveBtn.classList.add("hidden");
      if (cancelBtn) cancelBtn.classList.add("hidden");
    });
  }
});

// ================== CHECK FOR PENDING APPROVALS ON PAGE LOAD ==================
async function checkPendingApprovals() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser) return;
  
  try {
    const pendingRef = collection(db, "pending_edits");
    const q = query(pendingRef, 
      where("userId", "==", currentUser.idNumber),
      where("status", "==", "pending")
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Show notification that there are pending approvals
      const pendingCount = querySnapshot.size;
      const pendingBadge = document.createElement("div");
      pendingBadge.style.cssText = `
        background: #ff9800;
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      pendingBadge.innerHTML = `
        <i class='bx bx-time'></i>
        <span>You have ${pendingCount} pending change${pendingCount > 1 ? 's' : ''} waiting for admin approval.</span>
      `;
      
      const profileSection = document.querySelector(".profile");
      if (profileSection && !document.getElementById("pendingBadge")) {
        pendingBadge.id = "pendingBadge";
        profileSection.insertBefore(pendingBadge, profileSection.firstChild);
      }
    }
  } catch (err) {
    console.error("Error checking pending approvals:", err);
  }
}

// Call on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkPendingApprovals);
} else {
  checkPendingApprovals();
}