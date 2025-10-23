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
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
        photoURL: "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
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
        photoURL: "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
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

// ================== SIGN IN WITH REMEMBER ME ==================
// Elements
const rememberToggle = document.getElementById("rememberToggle");
const rememberIcon = document.getElementById("rememberIcon");
const idNumberInput = document.getElementById("idNumber");
const passwordInput = document.getElementById("password");

let rememberActive = false;

// Check saved data on page load
window.addEventListener("DOMContentLoaded", () => {
  const savedId = localStorage.getItem("rememberedId");
  const rememberStatus = localStorage.getItem("rememberStatus");

  if (rememberStatus === "true" && savedId) {
    idNumberInput.value = savedId;
    rememberActive = true;
    rememberIcon.classList.replace("fa-square", "fa-square-check");
  }
});

// Toggle icon + status on click
if (rememberToggle) {
  rememberToggle.addEventListener("click", () => {
    rememberActive = !rememberActive;
    rememberIcon.classList.toggle("fa-square");
    rememberIcon.classList.toggle("fa-square-check");
    localStorage.setItem("rememberStatus", rememberActive);
  });
}

// =============== Login Logic ===============
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

      // ✅ Save "Remember Me" state
      if (rememberActive) {
        localStorage.setItem("rememberedId", idNumber);
      } else {
        localStorage.removeItem("rememberedId");
        localStorage.removeItem("rememberStatus");
      }

      localStorage.setItem("currentUser", JSON.stringify(userData));

      // Redirect based on role
      if (userData.role === "admin") {
        Swal.fire("Welcome Admin!", "Redirecting to dashboard...", "success").then(() => {
          window.location.href =
            "admin_app/features/system/screens/home/dashboard.html";
        });
      } else {
        Swal.fire("Success", `Welcome back, ${userData.fullName}!`, "success").then(() => {
          window.location.href =
            "user_app/features/system/screens/home/home.html";
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
          photoURL: user.photoURL || "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
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

// ================== REMEMBER ME===============


// ================== FORGOT PASSWORD ===============
const resetLink = document.getElementById("reset");

if (resetLink) {
  resetLink.addEventListener("click", async (e) => {
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
      // 1️⃣ Search user by email in Firestore
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Swal.fire("Error", "No account found with that email.", "error");
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;

      // 2️⃣ Generate reset token and expiry (15 minutes)
      const token = Math.random().toString(36).substring(2, 15);
      const expiry = Date.now() + 1000 * 60 * 15; // 15 minutes

      // 3️⃣ Save the reset token and expiry to Firestore
      await updateDoc(userDoc.ref, {
        resetToken: token,
        resetExpires: expiry,
      });

      // 4️⃣ Build the actual reset link (update with your real URL)
      const resetLink = `http://127.0.0.1:5501/reset_password.html?token=${token}&id=${userId}`;

      // 5️⃣ Send email using EmailJS
      emailjs.init("SKq6rRh-aPDV4uugA");  // 🔑 Your EmailJS public key

      const emailParams = {
        to_email: email,               // Recipient email (provided by user)
        reset_link: resetLink,         // Actual reset link
      };

      // 6️⃣ Send email
      const response = await emailjs.send("service_nzwwgxd", "template_7r1j3kp", emailParams);

      if (response.status === 200) {
        Swal.fire(
          "Email Sent!",
          "Please check your Gmail for a password reset link. (Valid for 15 minutes)",
          "success"
        );
      } else {
        Swal.fire("Error", "Failed to send reset link via email.", "error");
      }

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

// ================== EDIT USER DATA ==================

document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.getElementById("edit-btn");
  const saveBtn = document.getElementById("save-btn");
  const cancelBtn = document.getElementById("cancel-btn");

  // Map your Firestore field names to HTML IDs
  const fieldMap = {
    "user-name": "fullName",
    "user-email": "email",
    "user-address": "address",
    "user-telephoneNo": "telephoneNo",
    "user-department": "department",
    "user-program": "program",
  };

  let originalData = {};

  // Hide save/cancel at start
  saveBtn.classList.add("hidden");
  cancelBtn.classList.add("hidden");

  // === EDIT MODE ===
  editBtn.addEventListener("click", () => {
    originalData = {};

    Object.keys(fieldMap).forEach((id) => {
      const el = document.getElementById(id);
      originalData[id] = el.textContent.trim();

      const input = document.createElement("input");
      input.type = "text";
      input.className = "editable";
      input.id = id;
      input.value = el.textContent.trim();
      el.replaceWith(input);
    });

    editBtn.classList.add("hidden");
    saveBtn.classList.remove("hidden");
    cancelBtn.classList.remove("hidden");
  });

  // === CANCEL EDIT ===
  cancelBtn.addEventListener("click", () => {
    Object.keys(fieldMap).forEach((id) => {
      const input = document.getElementById(id);
      const h4 = document.createElement("h4");
      h4.id = id;
      h4.textContent = originalData[id];
      input.replaceWith(h4);
    });

    editBtn.classList.remove("hidden");
    saveBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");
  });

  // === SAVE CHANGES ===
  saveBtn.addEventListener("click", async () => {
    const updatedData = {};
    Object.keys(fieldMap).forEach((id) => {
      const input = document.getElementById(id);
      updatedData[fieldMap[id]] = input.value.trim(); // use Firestore field names

      const h4 = document.createElement("h4");
      h4.id = id;
      h4.textContent = input.value.trim();
      input.replaceWith(h4);
    });

    try {
      // Get current user info
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      const userId = currentUser?.idNumber;

      if (!userId) throw new Error("User ID not found in localStorage.");

      const userRef = doc(db, "users", userId);

      // Use setDoc with merge = true to ensure creation/update both work
      await setDoc(
        userRef,
        {
          ...updatedData,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Update localStorage copy
      const newUserData = { ...currentUser, ...updatedData };
      localStorage.setItem("currentUser", JSON.stringify(newUserData));

      Swal.fire({
        icon: "success",
        title: "Profile Updated",
        text: "Your profile has been updated successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: error.message || "An error occurred while saving your changes.",
      });
    }

    editBtn.classList.remove("hidden");
    saveBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");
  });
});
