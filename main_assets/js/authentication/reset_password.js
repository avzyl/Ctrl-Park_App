// main_assets/js/authentication/reset_password.js
import { db } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Get URL params
const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const userId = params.get("id");

if (!token || !userId) {
  Swal.fire("Invalid Link", "Your reset link is invalid or missing.", "error").then(() => {
    window.location.href = "index.html";
  });
}

// Form submit
const form = document.getElementById("reset-form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const newPass = document.getElementById("newPassword").value;
  const confirmPass = document.getElementById("confirmPassword").value;

  if (newPass !== confirmPass) {
    Swal.fire("Error", "Passwords do not match!", "error");
    return;
  }

  try {
    // Fetch user doc
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      Swal.fire("Error", "User not found.", "error");
      return;
    }

    const userData = userSnap.data();

    // Validate token
    if (!userData.resetToken || userData.resetToken !== token) {
      Swal.fire("Error", "Invalid or expired reset token.", "error");
      return;
    }

    if (!userData.resetExpires || Date.now() > userData.resetExpires) {
      Swal.fire("Error", "Reset link has expired.", "error");
      return;
    }

    // Hash password
    const hashedPassword = CryptoJS.SHA256(newPass).toString();

    // Update Firestore & remove token
    await updateDoc(userRef, {
      password: hashedPassword,
      resetToken: null,
      resetExpires: null,
    });

    Swal.fire("Success", "Password reset successful! You can now sign in.", "success").then(() => {
      window.location.href = "index.html";
    });

  } catch (err) {
    console.error("Reset password error:", err);
    Swal.fire("Error", "Something went wrong.", "error");
  }
});
