import { db } from "../../../main_assets/js/authentication/firebase.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ======================= LOAD ADMIN AND USERS ======================= //
document.addEventListener("DOMContentLoaded", () => {

  const adminsTableBody = document.querySelector(".admins-table tbody");
  const driversTableBody = document.querySelector(".drivers-table tbody");
  const passengersTableBody = document.querySelector(".passengers-table tbody");

  // FETCH ADMINS
  async function fetchAdmins() {
    if (!adminsTableBody) return;
    try {
      const snapshot = await getDocs(collection(db, "admins"));
      adminsTableBody.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const admin = docSnap.data();

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${admin.fullName}</td>
          <td>${admin.idNumber}</td>
          <td>${admin.email}</td>
          <td>${admin.role}</td>
          <td>
            <button class="action-btn delete" data-id="${docSnap.id}" data-type="admins">Delete</button>
            <button class="action-btn deactivate" data-id="${docSnap.id}" data-type="admins">Deactivate</button>
            <button class="action-btn activate" data-id="${docSnap.id}" data-type="admins">Activate</button>
          </td>
        `;

        adminsTableBody.appendChild(row);
      });

      attachActionListeners();

    } catch (err) {
      console.log("Error loading admins:", err);
    }
  }

  // FETCH USERS
  async function fetchUsers() {
    if (!driversTableBody || !passengersTableBody) return;

    try {
      const snapshot = await getDocs(collection(db, "users"));
      driversTableBody.innerHTML = "";
      passengersTableBody.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const user = docSnap.data();
        const row = document.createElement("tr");

        const actionButtons = `
            <button class="action-btn delete" data-id="${docSnap.id}" data-type="users">Delete</button>
            <button class="action-btn deactivate" data-id="${docSnap.id}" data-type="users">Deactivate</button>
            <button class="action-btn activate" data-id="${docSnap.id}" data-type="users">Activate</button>
        `;

        if (user.role === "driver") {
          row.innerHTML = `
            <td>${user.fullName}</td>
            <td>${user.idNumber || "N/A"}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${actionButtons}</td>
          `;
          driversTableBody.appendChild(row);
        }

        else if (user.role === "passenger") {
          row.innerHTML = `
            <td>${user.fullName}</td>
            <td>${user.idNumber || "N/A"}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${actionButtons}</td>
          `;
          passengersTableBody.appendChild(row);
        }
      });

      attachActionListeners();

    } catch (err) {
      console.log("Error loading users:", err);
    }
  }

  // LISTENERS FOR BUTTONS
  function attachActionListeners() {
    document.querySelectorAll(".action-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const col = btn.dataset.type;

        if (btn.classList.contains("delete")) {
          confirmDelete(id, col);
        }

        else if (btn.classList.contains("deactivate")) {
          updateStatus(id, col, "inactive");
        }

        else if (btn.classList.contains("activate")) {
          updateStatus(id, col, "active");
        }
      });
    });
  }

  // DELETE USER
  async function confirmDelete(docId, collectionName) {
    const result = await Swal.fire({
      title: "Delete User?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteDoc(doc(db, collectionName, docId));

      Swal.fire("Deleted!", "User has been removed.", "success");

      fetchAdmins();
      fetchUsers();

    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  // UPDATE STATUS (ACTIVATE / DEACTIVATE)
  async function updateStatus(docId, collectionName, status) {
    try {
      await updateDoc(doc(db, collectionName, docId), {
        status: status
      });

      Swal.fire("Updated!", `User is now ${status}.`, "success");

      fetchAdmins();
      fetchUsers();

    } catch (err) {
      console.error("Status update error:", err);
    }
  }

  // RUN ON LOAD
  fetchAdmins();
  fetchUsers();

});
