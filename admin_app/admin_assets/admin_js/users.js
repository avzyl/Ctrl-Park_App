import { db } from "../../../main_assets/js/authentication/firebase.js";
import { logAdminAction } from "./logs.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Add this function near the top of users.js (after imports)
async function logUserAction(action, targetId, targetName, targetRole, details) {
    try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        const logRef = doc(db, "admin_action_logs", `${action}_${targetId}_${Date.now()}`);
        await setDoc(logRef, {
            action: action,
            adminName: currentUser?.fullName || "System",
            adminId: currentUser?.idNumber || "unknown",
            targetUser: targetName,
            targetId: targetId,
            targetRole: targetRole,
            details: details,
            timestamp: serverTimestamp()
        });
        console.log(`Action logged: ${action} for ${targetName}`);
    } catch (err) {
        console.error("Error logging action:", err);
    }
}

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
  // ======================= FETCH USERS WITH STATUS ======================= //
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

        // Check if the user is inactive and add a class
        if (user.status === "inactive") {
          row.classList.add("inactive"); // This adds the 'inactive' class to the row
        }

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

  // ======================= UPDATE STATUS FUNCTION ======================= //
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

let allAdmins = [];
let allDrivers = [];
let allPassengers = [];
let currentSearchTerm = "";
let currentStatusFilter = "all";

const adminsTableBody = document.querySelector(".admins-table tbody");
const driversTableBody = document.querySelector(".drivers-table tbody");
const passengersTableBody = document.querySelector(".passengers-table tbody");

function sortByNewest(arr) {
    return [...arr].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
    });
}

function hashPassword(password) {
    return CryptoJS.SHA256(password).toString();
}

async function fetchAllData() {
    try {
        const adminSnap = await getDocs(collection(db, "admins"));
        allAdmins = [];
        adminSnap.forEach(docSnap => {
            const admin = { id: docSnap.id, ...docSnap.data(), collectionType: "admins" };
            // Only add if not deleted
            if (!admin.isDeleted) {
                allAdmins.push(admin);
            }
        });
        
        const userSnap = await getDocs(collection(db, "users"));
        allDrivers = [];
        allPassengers = [];
        userSnap.forEach(docSnap => {
            const user = { id: docSnap.id, ...docSnap.data(), collectionType: "users" };
            // Only add if not deleted
            if (!user.isDeleted) {
                if (user.role === "driver") allDrivers.push(user);
                else if (user.role === "passenger") allPassengers.push(user);
            }
        });
        
        allAdmins = sortByNewest(allAdmins);
        allDrivers = sortByNewest(allDrivers);
        allPassengers = sortByNewest(allPassengers);
        
        renderTablesBySearch();
    } catch (err) {
        console.log("Error loading data:", err);
    }
}

function filterBySearch(list, term) {
    if (!term.trim()) return list;
    const lowerTerm = term.toLowerCase();
    return list.filter(item => {
        return (item.fullName && item.fullName.toLowerCase().includes(lowerTerm)) ||
               (item.email && item.email.toLowerCase().includes(lowerTerm)) ||
               (item.idNumber && item.idNumber.toLowerCase().includes(lowerTerm));
    });
}

function filterByStatus(list, statusFilter) {
    if (statusFilter === "all") return list;
    
    return list.filter(item => {
        const regStatus = item.reg_status || "approved";
        
        if (statusFilter === "pending") {
            return regStatus === "pending";
        }
        if (statusFilter === "active") {
            return regStatus !== "pending" && item.status === "active";
        }
        if (statusFilter === "inactive") {
            return regStatus !== "pending" && item.status === "inactive";
        }
        if (statusFilter === "deactivated") {
            return item.status === "deactivated";
        }
        return true;
    });
}

function renderTablesBySearch() {
    let filteredAdmins = filterBySearch(allAdmins, currentSearchTerm);
    let filteredDrivers = filterBySearch(allDrivers, currentSearchTerm);
    let filteredPassengers = filterBySearch(allPassengers, currentSearchTerm);
    
    filteredAdmins = filterByStatus(filteredAdmins, currentStatusFilter);
    filteredDrivers = filterByStatus(filteredDrivers, currentStatusFilter);
    filteredPassengers = filterByStatus(filteredPassengers, currentStatusFilter);
    
    const topAdmins = filteredAdmins.slice(0, 5);
    const topDrivers = filteredDrivers.slice(0, 5);
    const topPassengers = filteredPassengers.slice(0, 5);
    
    renderAdminTable(topAdmins);
    renderDriverTable(topDrivers);
    renderPassengerTable(topPassengers);
}

function renderAdminTable(adminsArray) {
    if (!adminsTableBody) return;
    adminsTableBody.innerHTML = "";
    
    adminsArray.forEach(admin => {
        const row = document.createElement("tr");
        const regStatus = admin.reg_status || "approved";
        
        if (regStatus === "pending") {
            row.classList.add("pending-row");
        } else if (admin.status === "deactivated") {
            row.classList.add("deactivated-row");
        } else if (admin.status === "inactive") {
            row.classList.add("inactive-row");
        }
        
        const adminType = admin.adminType === "super_admin" ? "Super Admin" : "Regular Admin";
        let displayStatus = "";
        let actionButtons = "";
        
        if (regStatus === "pending") {
            displayStatus = "Pending Approval";
            actionButtons = `
                <button class="action-btn approve" data-id="${admin.id}" data-type="admins">Approve</button>
                <button class="action-btn delete" data-id="${admin.id}" data-type="admins">Delete</button>
            `;
        } else if (admin.status === "deactivated") {
            displayStatus = "Deactivated (4 months)";
            actionButtons = `
                <button class="action-btn reactivate" data-id="${admin.id}" data-type="admins">Reactivate</button>
                <button class="action-btn delete" data-id="${admin.id}" data-type="admins">Delete</button>
            `;
        } else {
            displayStatus = admin.status === "inactive" ? "Inactive" : "Active";
            actionButtons = `
                <button class="action-btn delete" data-id="${admin.id}" data-type="admins">Delete</button>
                <button class="action-btn deactivate" data-id="${admin.id}" data-type="admins">Deactivate</button>
                <button class="action-btn activate" data-id="${admin.id}" data-type="admins">Activate</button>
            `;
        }
        
        row.innerHTML = `
            <td>${admin.fullName || ''}</td>
            <td>${admin.idNumber || ''}</td>
            <td>${admin.email || ''}</td>
            <td>${adminType}</td>
            <td>${displayStatus}</td>
            <td>${actionButtons}</td>
        `;
        adminsTableBody.appendChild(row);
    });
    attachActionListeners();
}

function renderDriverTable(driversArray) {
    if (!driversTableBody) return;
    driversTableBody.innerHTML = "";
    
    driversArray.forEach(driver => {
        const row = document.createElement("tr");
        const regStatus = driver.reg_status || "approved";
        
        if (regStatus === "pending") {
            row.classList.add("pending-row");
        } else if (driver.status === "deactivated") {
            row.classList.add("deactivated-row");
        } else if (driver.status === "inactive") {
            row.classList.add("inactive-row");
        }
        
        let displayStatus = "";
        let actionButtons = "";
        
        if (regStatus === "pending") {
            displayStatus = "Pending Approval";
            actionButtons = `
                <button class="action-btn approve" data-id="${driver.id}" data-type="users">Approve</button>
                <button class="action-btn delete" data-id="${driver.id}" data-type="users">Delete</button>
            `;
        } else if (driver.status === "deactivated") {
            displayStatus = "Deactivated (4 months)";
            actionButtons = `
                <button class="action-btn reactivate" data-id="${driver.id}" data-type="users">Reactivate</button>
                <button class="action-btn delete" data-id="${driver.id}" data-type="users">Delete</button>
            `;
        } else {
            displayStatus = driver.status === "inactive" ? "Inactive" : "Active";
            actionButtons = `
                <button class="action-btn delete" data-id="${driver.id}" data-type="users">Delete</button>
                <button class="action-btn deactivate" data-id="${driver.id}" data-type="users">Deactivate</button>
                <button class="action-btn activate" data-id="${driver.id}" data-type="users">Activate</button>
            `;
        }
        
        row.innerHTML = `
            <td>${driver.fullName || ''}</td>
            <td>${driver.idNumber || "N/A"}</td>
            <td>${driver.email || ''}</td>
            <td>${displayStatus}</td>
            <td>${actionButtons}</td>
        `;
        driversTableBody.appendChild(row);
    });
    attachActionListeners();
}

function renderPassengerTable(passengersArray) {
    if (!passengersTableBody) return;
    passengersTableBody.innerHTML = "";
    
    passengersArray.forEach(passenger => {
        const row = document.createElement("tr");
        const regStatus = passenger.reg_status || "approved";
        
        if (regStatus === "pending") {
            row.classList.add("pending-row");
        } else if (passenger.status === "deactivated") {
            row.classList.add("deactivated-row");
        } else if (passenger.status === "inactive") {
            row.classList.add("inactive-row");
        }
        
        let displayStatus = "";
        let actionButtons = "";
        
        if (regStatus === "pending") {
            displayStatus = "Pending Approval";
            actionButtons = `
                <button class="action-btn approve" data-id="${passenger.id}" data-type="users">Approve</button>
                <button class="action-btn delete" data-id="${passenger.id}" data-type="users">Delete</button>
            `;
        } else if (passenger.status === "deactivated") {
            displayStatus = "Deactivated (4 months)";
            actionButtons = `
                <button class="action-btn reactivate" data-id="${passenger.id}" data-type="users">Reactivate</button>
                <button class="action-btn delete" data-id="${passenger.id}" data-type="users">Delete</button>
            `;
        } else {
            displayStatus = passenger.status === "inactive" ? "Inactive" : "Active";
            actionButtons = `
                <button class="action-btn delete" data-id="${passenger.id}" data-type="users">Delete</button>
                <button class="action-btn deactivate" data-id="${passenger.id}" data-type="users">Deactivate</button>
                <button class="action-btn activate" data-id="${passenger.id}" data-type="users">Activate</button>
            `;
        }
        
        row.innerHTML = `
            <td>${passenger.fullName || ''}</td>
            <td>${passenger.idNumber || "N/A"}</td>
            <td>${passenger.email || ''}</td>
            <td>${displayStatus}</td>
            <td>${actionButtons}</td>
        `;
        passengersTableBody.appendChild(row);
    });
    attachActionListeners();
}

async function approveUser(docId, collectionName) {
    try {
        // Get user data first for logging
        const userSnap = await getDoc(doc(db, collectionName, docId));
        const userData = userSnap.data();
        
        await updateDoc(doc(db, collectionName, docId), {
            reg_status: "approved",
            status: "active"
        });
        
        // CALL THE LOG FUNCTION HERE
        await logUserAction(
            "approve_user", 
            docId, 
            userData.fullName, 
            userData.role, 
            `Approved ${userData.role} registration for ${userData.fullName}`
        );
        
        Swal.fire("Approved!", "User has been approved and activated.", "success");
        await fetchAllData();
    } catch (err) {
        console.error("Approve error:", err);
        Swal.fire("Error!", "Could not approve user.", "error");
    }
}

async function reactivateUser(docId, collectionName) {
    const result = await Swal.fire({
        title: "Reactivate Account?",
        text: "This will reactivate the user's account. They will be able to login again.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Reactivate",
        cancelButtonText: "Cancel",
    });
    
    if (!result.isConfirmed) return;
    
    try {
        // Get user data first
        const userSnap = await getDoc(doc(db, collectionName, docId));
        const userData = userSnap.data();
        
        await updateDoc(doc(db, collectionName, docId), {
            status: "active",
            reg_status: "approved",
            reactivatedAt: serverTimestamp(),
            deactivatedReason: null,
            lastLoginAt: null
        });
        
        // CALL THE LOG FUNCTION HERE
        await logUserAction(
            "reactivate", 
            docId, 
            userData.fullName, 
            userData.role, 
            `Reactivated ${userData.role} account for ${userData.fullName}`
        );
        
        Swal.fire("Reactivated!", "User account has been reactivated.", "success");
        await fetchAllData();
    } catch (err) {
        console.error("Reactivation error:", err);
        Swal.fire("Error!", "Could not reactivate user.", "error");
    }
}

async function updateStatus(docId, collectionName, status) {
    try {
        // Get user data first
        const userSnap = await getDoc(doc(db, collectionName, docId));
        const userData = userSnap.data();
        
        await updateDoc(doc(db, collectionName, docId), { status: status });
        
        // CALL THE LOG FUNCTION HERE
        const actionType = status === "inactive" ? "deactivate" : "activate";
        const actionText = status === "inactive" ? "Deactivated" : "Activated";
        
        await logUserAction(
            actionType, 
            docId, 
            userData.fullName, 
            userData.role, 
            `${actionText} ${userData.role} account for ${userData.fullName}`
        );
        
        Swal.fire("Updated!", `User is now ${status}.`, "success");
        await fetchAllData();
    } catch (err) {
        console.error("Status update error:", err);
        Swal.fire("Error!", "Could not update status.", "error");
    }
}

async function confirmDelete(docId, collectionName) {
    const result = await Swal.fire({
        title: "Delete User?",
        text: "This user will be soft deleted and will not appear in any table. You can restore them later if needed.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Delete",
        cancelButtonText: "Cancel",
    });
    
    if (!result.isConfirmed) return;
    
    try {
        // Get user data first
        const userSnap = await getDoc(doc(db, collectionName, docId));
        const userData = userSnap.data();
        
        await updateDoc(doc(db, collectionName, docId), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: JSON.parse(localStorage.getItem("currentUser"))?.fullName || "Admin"
        });
        
        // CALL THE LOG FUNCTION HERE
        await logUserAction(
            "soft_delete", 
            docId, 
            userData.fullName, 
            userData.role, 
            `Soft deleted ${userData.role} account for ${userData.fullName}`
        );
        
        Swal.fire("Deleted!", "User has been soft deleted.", "success");
        await fetchAllData();
    } catch (err) {
        console.error("Delete error:", err);
        Swal.fire("Error!", "Could not delete user.", "error");
    }
}

function attachActionListeners() {
    document.querySelectorAll(".action-btn").forEach(btn => {
        btn.removeEventListener("click", handleActionClick);
        btn.addEventListener("click", handleActionClick);
    });
}

async function handleActionClick(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    const col = btn.dataset.type;
    
    if (btn.classList.contains("delete")) {
        await confirmDelete(id, col);
    } else if (btn.classList.contains("deactivate")) {
        await updateStatus(id, col, "inactive");
    } else if (btn.classList.contains("activate")) {
        await updateStatus(id, col, "active");
    } else if (btn.classList.contains("approve")) {
        await approveUser(id, col);
    } else if (btn.classList.contains("reactivate")) {
        await reactivateUser(id, col);
    }
}

// ========== DRIVER CAR PASS SUGGESTION ==========
async function setupDriverSuggestion() {
    const carPassInput = document.querySelector("#driver-register-form input[name='carPassNumber']");
    if (!carPassInput) return;
    
    const existingSuggestion = document.getElementById("carPassSuggestion");
    if (existingSuggestion) existingSuggestion.remove();
    
    try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        
        let maxNumber = 0;
        
        querySnapshot.forEach(doc => {
            const user = doc.data();
            if (user.role === "driver" && user.idNumber) {
                const match = user.idNumber.toString().match(/S2026-(\d+)/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
        });
        
        const nextNumber = maxNumber + 1;
        const paddedNumber = String(nextNumber).padStart(5, '0');
        const suggestedPass = `S2026-${paddedNumber}`;
        
        const suggestionDiv = document.createElement('div');
        suggestionDiv.id = "carPassSuggestion";
        suggestionDiv.style.cssText = "margin-top: -10px; margin-bottom: 10px; font-size: 12px; color: #666;";
        suggestionDiv.innerHTML = `
            <label style="cursor: pointer;">
                <input type="checkbox" id="autoFillCarPass" style="margin-right: 5px;">
                Use suggested number: <strong>${suggestedPass}</strong>
            </label>
            ${maxNumber > 0 ? `<div style="font-size: 11px; color: #888; margin-top: 5px;">Last used: S2026-${String(maxNumber).padStart(5, '0')}</div>` : ''}
        `;
        carPassInput.parentNode.insertBefore(suggestionDiv, carPassInput.nextSibling);
        
        const autoFillCheck = document.getElementById("autoFillCarPass");
        if (autoFillCheck) {
            autoFillCheck.addEventListener("change", (e) => {
                if (e.target.checked) {
                    carPassInput.value = suggestedPass;
                    carPassInput.style.backgroundColor = "#e8f0fe";
                } else {
                    carPassInput.value = "";
                    carPassInput.style.backgroundColor = "";
                }
            });
        }
        
        carPassInput.placeholder = "Or enter custom number";
    } catch (err) {
        console.error("Error getting last car pass:", err);
        carPassInput.placeholder = "e.g., S2026-00001";
    }
}

// ========== REGISTRATION FORMS ==========

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
        const adminType = adminForm["adminType"].value;
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
                fullName, email, password: hashPassword(password), role: "admin",
                adminType: adminType, idNumber: workId,
                photoURL: "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
                createdAt: serverTimestamp(), reg_status: "pending", status: "inactive", isDeleted: false
            };
            
            await setDoc(userRef, userData);
            
            // ========== ADD LOG HERE - AFTER SUCCESSFUL REGISTRATION ==========
            await logUserAction(
                "register_admin",
                workId,
                fullName,
                "admin",
                `Registered new admin: ${fullName} (${workId}) - ${adminType}`
            );
            // ================================================================
            
            const modal = document.getElementById("registerAdminModal");
            if (modal) modal.classList.remove("active");
            adminForm.reset();
            
            Swal.fire("Success", "Admin account created successfully! Waiting for approval.", "success");
            await fetchAllData();
        } catch (error) {
            Swal.fire("Error", error.message, "error");
        } finally {
            btn.disabled = false;
            btn.value = originalText;
        }
    });
}

const driverForm = document.getElementById("driver-register-form");
if (driverForm) {
    driverForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const btn = driverForm.querySelector('input[type="submit"]');
        const originalText = btn.value;
        btn.disabled = true;
        btn.value = "Registering...";
        
        const fullName = driverForm["fullName"].value.trim();
        const carPassNumber = driverForm["carPassNumber"].value.trim();
        const email = driverForm["email"].value.trim();
        const password = driverForm["password"].value.trim();
        const plateNumber = driverForm["plateNumber"]?.value.trim() || "";
        const termsChecked = driverForm["terms"].checked;
        
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
            const userRef = doc(db, "users", carPassNumber);
            const docSnap = await getDoc(userRef);
            
            if (docSnap.exists()) {
                Swal.fire("Error", "This Car Pass Number is already registered.", "error");
                btn.disabled = false;
                btn.value = originalText;
                return;
            }
            
            const userData = {
                fullName, email, password: hashPassword(password), role: "driver",
                idNumber: carPassNumber, plateNumber: plateNumber,
                photoURL: "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
                createdAt: serverTimestamp(), reg_status: "pending", status: "inactive", isDeleted: false
            };
            
            await setDoc(userRef, userData);
            
            // ========== ADD LOG HERE ==========
            await logUserAction(
                "register_driver",
                carPassNumber,
                fullName,
                "driver",
                `Registered new driver: ${fullName} (${carPassNumber})`
            );

            const modal = document.getElementById("registerDriverModal");
            if (modal) modal.classList.remove("active");
            driverForm.reset();
            
            Swal.fire("Success", "Driver account created successfully! Waiting for approval.", "success");
            await fetchAllData();
        } catch (error) {
            Swal.fire("Error", error.message, "error");
        } finally {
            btn.disabled = false;
            btn.value = originalText;
        }
    });
}

const passengerForm = document.getElementById("passenger-register-form");
if (passengerForm) {
    passengerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const btn = passengerForm.querySelector('input[type="submit"]');
        const originalText = btn.value;
        btn.disabled = true;
        btn.value = "Registering...";
        
        const fullName = passengerForm["fullName"].value.trim();
        const studentNumber = passengerForm["studentNumber"].value.trim();
        const email = passengerForm["email"].value.trim();
        const password = passengerForm["password"].value.trim();
        const termsChecked = passengerForm["terms"].checked;
        
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
            const userRef = doc(db, "users", studentNumber);
            const docSnap = await getDoc(userRef);
            
            if (docSnap.exists()) {
                Swal.fire("Error", "This Student Number is already registered.", "error");
                btn.disabled = false;
                btn.value = originalText;
                return;
            }
            
            const userData = {
                fullName, email, password: hashPassword(password), role: "passenger",
                idNumber: studentNumber,
                photoURL: "https://res.cloudinary.com/doy8exjvc/image/upload/v1760862771/pfp_p5nfuq.jpg",
                createdAt: serverTimestamp(), reg_status: "pending", status: "inactive", isDeleted: false
            };
            
            await setDoc(userRef, userData);

            // ========== ADD LOG HERE ==========
            await logUserAction(
                "register_passenger",
                studentNumber,
                fullName,
                "passenger",
                `Registered new passenger: ${fullName} (${studentNumber})`
            );
            // =================================

            const modal = document.getElementById("registerPassengerModal");
            if (modal) modal.classList.remove("active");
            passengerForm.reset();
            
            Swal.fire("Success", "Passenger account created successfully! Waiting for approval.", "success");
            await fetchAllData();
        } catch (error) {
            Swal.fire("Error", error.message, "error");
        } finally {
            btn.disabled = false;
            btn.value = originalText;
        }
    });
}

function openModalForCategory(category) {
    const modal = document.getElementById("allUsersModal");
    const modalTitle = document.getElementById("modalCategoryTitle");
    const modalBody = document.getElementById("modalBodyContent");
    
    let list = [];
    let title = "";
    let headers = [];
    
    if (category === "admins") {
        list = filterByStatus(filterBySearch(allAdmins, currentSearchTerm), currentStatusFilter);
        title = "All Admins";
        headers = ["Full Name", "Work ID", "Email", "Admin Type", "Status"];
    } else if (category === "drivers") {
        list = filterByStatus(filterBySearch(allDrivers, currentSearchTerm), currentStatusFilter);
        title = "All Drivers";
        headers = ["Full Name", "Car Pass Number", "Email", "Status"];
    } else {
        list = filterByStatus(filterBySearch(allPassengers, currentSearchTerm), currentStatusFilter);
        title = "All Passengers";
        headers = ["Full Name", "Student Number", "Email", "Status"];
    }
    
    modalTitle.innerText = title;
    
    if (list.length === 0) {
        modalBody.innerHTML = "<p>No users found.</p>";
        modal.classList.add("active");
        return;
    }
    
    let tableHTML = `<table><thead><tr>`;
    headers.forEach(h => { tableHTML += `<th>${h}</th>`; });
    tableHTML += `</tr></thead><tbody>`;
    
    list.forEach(user => {
        let statusBadge = "";
        if (category === "admins") {
            const regStatus = user.reg_status || "approved";
            if (regStatus === "pending") statusBadge = "Pending Approval";
            else if (user.status === "deactivated") statusBadge = "Deactivated (4 months)";
            else statusBadge = user.status === "inactive" ? "Inactive" : "Active";
            const adminType = user.adminType === "super_admin" ? "Super Admin" : "Regular Admin";
            tableHTML += `<tr><td>${user.fullName || ''}</td><td>${user.idNumber || ''}</td><td>${user.email || ''}</td><td>${adminType}</td><td>${statusBadge}</td></tr>`;
        } else {
            const regStatus = user.reg_status || "approved";
            if (regStatus === "pending") statusBadge = "Pending Approval";
            else if (user.status === "deactivated") statusBadge = "Deactivated (4 months)";
            else statusBadge = user.status === "inactive" ? "Inactive" : "Active";
            tableHTML += `<tr><td>${user.fullName || ''}</td><td>${user.idNumber || 'N/A'}</td><td>${user.email || ''}</td><td>${statusBadge}</td></tr>`;
        }
    });
    
    tableHTML += `</tbody></table>`;
    modalBody.innerHTML = tableHTML;
    modal.classList.add("active");
}

function setupSearch() {
    const searchInput = document.getElementById("globalSearchInput");
    const searchBtn = document.getElementById("globalSearchBtn");
    const clearBtn = document.getElementById("clearSearchBtn");
    const statusFilter = document.getElementById("statusFilter");
    
    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            currentSearchTerm = searchInput.value.trim();
            currentStatusFilter = statusFilter ? statusFilter.value : "all";
            renderTablesBySearch();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            searchInput.value = "";
            currentSearchTerm = "";
            if (statusFilter) statusFilter.value = "all";
            currentStatusFilter = "all";
            renderTablesBySearch();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener("change", () => {
            currentStatusFilter = statusFilter.value;
            renderTablesBySearch();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                currentSearchTerm = searchInput.value.trim();
                currentStatusFilter = statusFilter ? statusFilter.value : "all";
                renderTablesBySearch();
            }
        });
    }
}

function setupShowAllModals() {
    document.querySelectorAll(".show-all-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const category = link.dataset.category;
            if (category) openModalForCategory(category);
        });
    });
}

function initModalClose() {
    const modal = document.getElementById("allUsersModal");
    const closeBtn = document.getElementById("closeModalBtn");
    
    if (closeBtn) {
        closeBtn.addEventListener("click", () => modal.classList.remove("active"));
    }
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("active");
        });
    }
}

const addDriverBtn = document.getElementById("addDriverBtn");
if (addDriverBtn) {
    addDriverBtn.addEventListener("click", async () => {
        await setupDriverSuggestion();
        const modal = document.getElementById("registerDriverModal");
        if (modal) modal.classList.add("active");
    });
}

const closeDriverModalBtn = document.getElementById("closeDriverModalBtn");
if (closeDriverModalBtn) {
    closeDriverModalBtn.addEventListener("click", () => {
        const suggestion = document.getElementById("carPassSuggestion");
        if (suggestion) suggestion.remove();
        const modal = document.getElementById("registerDriverModal");
        if (modal) modal.classList.remove("active");
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await fetchAllData();
    setupSearch();
    setupShowAllModals();
    initModalClose();
});