import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Wait until DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  
  const adminsTableBody = document.querySelector(".admins-table tbody");
  const driversTableBody = document.querySelector(".drivers-table tbody");
  const passengersTableBody = document.querySelector(".passengers-table tbody");

  // ---------- FETCH ADMINS ----------
  async function fetchAdmins() {
    if (!adminsTableBody) return;
    try {
      const querySnapshot = await getDocs(collection(db, "admins"));
      adminsTableBody.innerHTML = "";

      querySnapshot.forEach((doc) => {
        const admin = doc.data();
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${admin.fullName}</td>
          <td>${admin.idNumber}</td>
          <td>${admin.email}</td>
          <td>${admin.role}</td>
          <td><button class="edit-btn">Edit</button></td>
        `;
        adminsTableBody.appendChild(row);
      });
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  }

  // ---------- FETCH USERS ----------
  async function fetchUsers() {
    if (!driversTableBody || !passengersTableBody) return;
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      
      // Clear tables first
      driversTableBody.innerHTML = "";
      passengersTableBody.innerHTML = "";

      querySnapshot.forEach((doc) => {
        const user = doc.data();
        const row = document.createElement("tr");

        if (user.role === "driver") {
          row.innerHTML = `
            <td>${user.fullName}</td>
            <td>${user.carPassNumber || "N/A"}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td><button class="edit-btn">Edit</button></td>
          `;
          driversTableBody.appendChild(row);
        } else if (user.role === "passenger") {
          row.innerHTML = `
            <td>${user.fullName}</td>
            <td>${user.idNumber || "N/A"}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td><button class="edit-btn">Edit</button></td>
          `;
          passengersTableBody.appendChild(row);
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  // Call both functions
  fetchAdmins();
  fetchUsers();

});

// Populate profile dynamically
document.addEventListener("DOMContentLoaded", () => {
    const userData = JSON.parse(localStorage.getItem("currentUser"));

    if (userData) {
        const userNameEl = document.querySelector(".user-name");
        const userRoleEl = document.querySelector(".user-role");
        const userPhotoEl = document.querySelector(".user-photo");

        userNameEl.textContent = userData.fullName || "User";
        userRoleEl.textContent = userData.role || "Role";
        userPhotoEl.src = userData.photoURL || "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg";
    }
});

document.addEventListener("DOMContentLoaded", () => {
  // ======== DYNAMIC PROFILE ========
  const userData = JSON.parse(localStorage.getItem("currentUser"));

  if (userData) {
    const userNameEl = document.querySelector(".user-name");
    const userRoleEl = document.querySelector(".user-role");
    const userPhotoEl = document.querySelector(".user-photo");

    userNameEl.textContent = userData.fullName || "User";
    userRoleEl.textContent = userData.role || "Role";
    userPhotoEl.src = userData.photoURL || "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg";
  }

  // ======== LOGOUT FUNCTIONALITY ========
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
            // If using Firebase Auth
            if (typeof auth !== "undefined") {
              await auth.signOut();
            }
          } catch (err) {
            console.warn("SignOut error:", err);
          }

          // Clear localStorage
          localStorage.removeItem("currentUser");

          Swal.fire({
            title: "Logged Out",
            text: "You have been successfully logged out.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
            willClose: () => { window.location.href = "/index.html"; } // redirect to login
          });
        }
      });
    });
  }
});
document.addEventListener("DOMContentLoaded", () => {
  // ======== DYNAMIC PROFILE ========
  const userData = JSON.parse(localStorage.getItem("currentUser"));

  if (userData) {
    const userNameEl = document.querySelector(".user-name");
    const userRoleEl = document.querySelector(".user-role");
    const userPhotoEl = document.querySelector(".user-photo");

    userNameEl.textContent = userData.fullName || "User";
    userRoleEl.textContent = userData.role || "Role";
    userPhotoEl.src = userData.photoURL || "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg";
  }

  // ======== LOGOUT FUNCTIONALITY ========
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
            // If using Firebase Auth
            if (typeof auth !== "undefined") {
              await auth.signOut();
            }
          } catch (err) {
            console.warn("SignOut error:", err);
          }

          // Clear localStorage
          localStorage.removeItem("currentUser");

          Swal.fire({
            title: "Logged Out",
            text: "You have been successfully logged out.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
            willClose: () => { window.location.href = "/index.html"; } // redirect to login
          });
        }
      });
    });
  }
});
