import { db } from "../../../main_assets/js/authentication/firebase.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

async function logEditAction(action, editId, userId, userName, userRole, details) {
    try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        const logRef = doc(db, "admin_action_logs", `${action}_${editId}_${Date.now()}`);
        await setDoc(logRef, {
            action: action,
            adminName: currentUser?.fullName || "System",
            adminId: currentUser?.idNumber || "unknown",
            targetUser: userName,
            targetId: userId,
            targetRole: userRole,
            details: details,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Error logging edit action:", err);
    }
}

// ======================= GLOBALS ======================= //
let allLogs = [];
let currentSearchTerm = "";
let currentSortField = "loginTime";
let currentSortDirection = "desc";
let currentStartDate = "";
let currentEndDate = "";

// ======================= FETCH LOG HISTORY ======================= //
async function fetchLogHistory() {
    try {
        const logsRef = collection(db, "log_history");
        const q = query(logsRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        allLogs = [];
        querySnapshot.forEach(doc => {
            const log = { id: doc.id, ...doc.data() };
            allLogs.push(log);
        });
        
        renderRecentLogs();
    } catch (err) {
        console.error("Error fetching logs:", err);
        const recentBody = document.getElementById("recentLogsBody");
        if (recentBody) {
            recentBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading logs</td></tr>';
        }
    }
}

// ======================= GROUP LOGS BY USER ======================= //
function groupLogsByUser(logs) {
    const userMap = new Map();
    
    logs.forEach(log => {
        const userId = log.userId;
        if (!userMap.has(userId)) {
            userMap.set(userId, {
                userId: userId,
                userName: log.userName,
                userEmail: log.userEmail,
                userRole: log.userRole,
                loginLogs: [],
                logoutLogs: []
            });
        }
        
        const user = userMap.get(userId);
        if (log.action === "login") {
            user.loginLogs.push({
                timestamp: log.timestamp,
                date: log.date,
                time: log.time,
                fullTimestamp: log.timestamp?.toMillis ? log.timestamp.toMillis() : 0
            });
        } else if (log.action === "logout" || log.action === "auto-logout-inactivity") {
            user.logoutLogs.push({
                timestamp: log.timestamp,
                date: log.date,
                time: log.time,
                fullTimestamp: log.timestamp?.toMillis ? log.timestamp.toMillis() : 0
            });
        }
    });
    
    // Match logins with logouts and create session entries
    const sessions = [];
    
    userMap.forEach(user => {
        const sortedLogins = [...user.loginLogs].sort((a, b) => a.fullTimestamp - b.fullTimestamp);
        const sortedLogouts = [...user.logoutLogs].sort((a, b) => a.fullTimestamp - b.fullTimestamp);
        
        let logoutIndex = 0;
        
        sortedLogins.forEach(login => {
            let matchedLogout = null;
            
            while (logoutIndex < sortedLogouts.length && sortedLogouts[logoutIndex].fullTimestamp <= login.fullTimestamp) {
                logoutIndex++;
            }
            
            if (logoutIndex < sortedLogouts.length) {
                matchedLogout = sortedLogouts[logoutIndex];
                logoutIndex++;
            }
            
            sessions.push({
                userId: user.userId,
                userName: user.userName,
                userEmail: user.userEmail,
                userRole: user.userRole,
                loginTime: login,
                logoutTime: matchedLogout,
                idNumber: user.userId
            });
        });
    });
    
    sessions.sort((a, b) => b.loginTime.fullTimestamp - a.loginTime.fullTimestamp);
    
    return sessions;
}

// ======================= FILTER SESSIONS ======================= //
function filterSessions(sessions) {
    let filtered = [...sessions];
    
    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        filtered = filtered.filter(session => 
            (session.userName && session.userName.toLowerCase().includes(term)) ||
            (session.userEmail && session.userEmail.toLowerCase().includes(term)) ||
            (session.idNumber && session.idNumber.toLowerCase().includes(term))
        );
    }
    
    if (currentStartDate) {
        const startDateTime = new Date(currentStartDate).setHours(0, 0, 0, 0);
        filtered = filtered.filter(session => session.loginTime.fullTimestamp >= startDateTime);
    }
    
    if (currentEndDate) {
        const endDateTime = new Date(currentEndDate).setHours(23, 59, 59, 999);
        filtered = filtered.filter(session => session.loginTime.fullTimestamp <= endDateTime);
    }
    
    filtered.sort((a, b) => {
        let aVal, bVal;
        
        switch(currentSortField) {
            case "userName":
                aVal = a.userName || "";
                bVal = b.userName || "";
                break;
            case "idNumber":
                aVal = a.idNumber || "";
                bVal = b.idNumber || "";
                break;
            case "userRole":
                aVal = a.userRole || "";
                bVal = b.userRole || "";
                break;
            case "loginTime":
                aVal = a.loginTime.fullTimestamp;
                bVal = b.loginTime.fullTimestamp;
                break;
            case "logoutTime":
                aVal = a.logoutTime ? a.logoutTime.fullTimestamp : 0;
                bVal = b.logoutTime ? b.logoutTime.fullTimestamp : 0;
                break;
            default:
                aVal = a.loginTime.fullTimestamp;
                bVal = b.loginTime.fullTimestamp;
        }
        
        if (currentSortDirection === "asc") {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    return filtered;
}

// ======================= RENDER RECENT LOGS (TOP 5) ======================= //
function renderRecentLogs() {
    const recentBody = document.getElementById("recentLogsBody");
    if (!recentBody) return;
    
    const sessions = groupLogsByUser(allLogs);
    const filtered = filterSessions(sessions);
    const recentSessions = filtered.slice(0, 5);
    
    if (recentSessions.length === 0) {
        recentBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No log history found</td></tr>';
        return;
    }
    
    recentBody.innerHTML = "";
    
    recentSessions.forEach(session => {
        const row = document.createElement("tr");
        
        const loginDate = session.loginTime.date || new Date(session.loginTime.fullTimestamp).toLocaleDateString();
        const loginTimeOnly = session.loginTime.time || new Date(session.loginTime.fullTimestamp).toLocaleTimeString();
        const loginDisplay = `${loginDate} ${loginTimeOnly}`;
        
        let logoutDisplay = "Still logged in";
        if (session.logoutTime) {
            const logoutDate = session.logoutTime.date || new Date(session.logoutTime.fullTimestamp).toLocaleDateString();
            const logoutTimeOnly = session.logoutTime.time || new Date(session.logoutTime.fullTimestamp).toLocaleTimeString();
            logoutDisplay = `${logoutDate} ${logoutTimeOnly}`;
        }
        
        let idDisplay = session.idNumber || "-";
        
        row.innerHTML = `
            <td>${session.userName || "-"}</td>
            <td>${idDisplay}</td>
            <td>${session.userRole || "-"}</td>
            <td><span class="login-badge">${loginDisplay}</span></td>
            <td><span class="logout-badge">${logoutDisplay}</span></td>
        `;
        recentBody.appendChild(row);
    });
}

// ======================= RENDER ALL LOGS IN MODAL ======================= //
let currentModalSessions = [];

function renderAllLogsModal() {
    const tableBody = document.getElementById("allLogsTableBody");
    if (!tableBody) return;
    
    const sessions = groupLogsByUser(allLogs);
    currentModalSessions = filterSessions(sessions);
    
    if (currentModalSessions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No log history found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = "";
    
    currentModalSessions.forEach(session => {
        const row = document.createElement("tr");
        
        const loginDate = session.loginTime.date || new Date(session.loginTime.fullTimestamp).toLocaleDateString();
        const loginTimeOnly = session.loginTime.time || new Date(session.loginTime.fullTimestamp).toLocaleTimeString();
        const loginDisplay = `${loginDate} ${loginTimeOnly}`;
        
        let logoutDisplay = "Still logged in";
        if (session.logoutTime) {
            const logoutDate = session.logoutTime.date || new Date(session.logoutTime.fullTimestamp).toLocaleDateString();
            const logoutTimeOnly = session.logoutTime.time || new Date(session.logoutTime.fullTimestamp).toLocaleTimeString();
            logoutDisplay = `${logoutDate} ${logoutTimeOnly}`;
        }
        
        let idDisplay = session.idNumber || "-";
        
        row.innerHTML = `
            <td>${session.userName || "-"}</td>
            <td>${idDisplay}</td>
            <td>${session.userRole || "-"}</td>
            <td>${loginDisplay}</td>
            <td>${logoutDisplay}</td>
        `;
        tableBody.appendChild(row);
    });
}

// ======================= UPDATE MODAL WITH CURRENT FILTERS ======================= //
function updateModalFilters() {
    const modalStartDate = document.getElementById("modalStartDate");
    const modalEndDate = document.getElementById("modalEndDate");
    
    currentStartDate = modalStartDate ? modalStartDate.value : "";
    currentEndDate = modalEndDate ? modalEndDate.value : "";
    
    renderAllLogsModal();
}

// ======================= SORT FUNCTION ======================= //
function sortBy(field) {
    if (currentSortField === field) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
    } else {
        currentSortField = field;
        currentSortDirection = "desc";
    }
    
    const sortIcons = document.querySelectorAll(".sort-icon");
    sortIcons.forEach(icon => {
        icon.textContent = "↕️";
    });
    
    const activeHeader = document.getElementById(`sort${field.charAt(0).toUpperCase() + field.slice(1)}`);
    if (activeHeader) {
        const icon = activeHeader.querySelector(".sort-icon");
        if (icon) {
            icon.textContent = currentSortDirection === "asc" ? "↑" : "↓";
        }
    }
    
    renderAllLogsModal();
}

// ======================= SEARCH FUNCTIONALITY ======================= //
function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const clearBtn = document.getElementById("clearBtn");
    const startDateFilter = document.getElementById("startDateFilter");
    const endDateFilter = document.getElementById("endDateFilter");
    
    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            currentSearchTerm = searchInput ? searchInput.value.trim() : "";
            currentStartDate = startDateFilter ? startDateFilter.value : "";
            currentEndDate = endDateFilter ? endDateFilter.value : "";
            renderRecentLogs();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (startDateFilter) startDateFilter.value = "";
            if (endDateFilter) endDateFilter.value = "";
            currentSearchTerm = "";
            currentStartDate = "";
            currentEndDate = "";
            renderRecentLogs();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                currentSearchTerm = searchInput.value.trim();
                currentStartDate = startDateFilter ? startDateFilter.value : "";
                currentEndDate = endDateFilter ? endDateFilter.value : "";
                renderRecentLogs();
            }
        });
    }
    
    if (startDateFilter) {
        startDateFilter.addEventListener("change", () => {
            currentStartDate = startDateFilter.value;
            renderRecentLogs();
        });
    }
    
    if (endDateFilter) {
        endDateFilter.addEventListener("change", () => {
            currentEndDate = endDateFilter.value;
            renderRecentLogs();
        });
    }
}

// ======================= MODAL SETUP ======================= //
function setupModal() {
    const showAllLink = document.getElementById("showAllLogsLink");
    const modal = document.getElementById("allLogsModal");
    const closeBtn = document.getElementById("closeLogsModalBtn");
    const modalFilterBtn = document.getElementById("modalFilterBtn");
    const modalStartDate = document.getElementById("modalStartDate");
    const modalEndDate = document.getElementById("modalEndDate");
    
    const sortName = document.getElementById("sortName");
    const sortId = document.getElementById("sortId");
    const sortRole = document.getElementById("sortRole");
    const sortLogin = document.getElementById("sortLogin");
    const sortLogout = document.getElementById("sortLogout");
    
    if (sortName) sortName.addEventListener("click", () => sortBy("userName"));
    if (sortId) sortId.addEventListener("click", () => sortBy("idNumber"));
    if (sortRole) sortRole.addEventListener("click", () => sortBy("userRole"));
    if (sortLogin) sortLogin.addEventListener("click", () => sortBy("loginTime"));
    if (sortLogout) sortLogout.addEventListener("click", () => sortBy("logoutTime"));
    
    if (showAllLink) {
        showAllLink.addEventListener("click", (e) => {
            e.preventDefault();
            
            if (modalStartDate) modalStartDate.value = currentStartDate;
            if (modalEndDate) modalEndDate.value = currentEndDate;
            
            renderAllLogsModal();
            if (modal) modal.classList.add("active");
        });
    }
    
    if (modalFilterBtn) {
        modalFilterBtn.addEventListener("click", () => {
            if (modalStartDate) currentStartDate = modalStartDate.value;
            if (modalEndDate) currentEndDate = modalEndDate.value;
            renderAllLogsModal();
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            if (modal) modal.classList.remove("active");
        });
    }
    
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("active");
        });
    }
}

// ======================= PENDING EDITS FUNCTIONS ======================= //

// Fetch and display pending edits
async function loadPendingEdits() {
    try {
        const pendingRef = collection(db, "pending_edits");
        const q = query(pendingRef, where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        
        const tbody = document.getElementById("pendingEditsBody");
        if (!tbody) return;
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No pending requests</td></tr>';
            return;
        }
        
        tbody.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const changes = Object.entries(data.editData).map(([k, v]) => `${k}: ${v}`).join("<br>");
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${data.userId || "-"}</td>
                <td>${data.userRole || "-"}</td>
                <td>${data.requestedBy || "-"}</td>
                <td>${data.requestedAt?.toDate ? data.requestedAt.toDate().toLocaleString() : "-"}</td>
                <td>${changes || "-"}</td>
                <td>
                    <button class="approve-btn" data-id="${doc.id}" data-user="${data.userId}" data-collection="${data.collectionName}">Approve</button>
                    <button class="reject-btn" data-id="${doc.id}">Reject</button>
                </td>
            `;
        });
        
        // Add event listeners
        document.querySelectorAll(".approve-btn").forEach(btn => {
            btn.removeEventListener("click", approveClickHandler);
            btn.addEventListener("click", approveClickHandler);
        });
        
        document.querySelectorAll(".reject-btn").forEach(btn => {
            btn.removeEventListener("click", rejectClickHandler);
            btn.addEventListener("click", rejectClickHandler);
        });
        
    } catch (err) {
        console.error("Error loading pending edits:", err);
        const tbody = document.getElementById("pendingEditsBody");
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading requests</td></tr>';
        }
    }
}

// Approve handler
async function approveClickHandler(e) {
    const btn = e.currentTarget;
    const editId = btn.dataset.id;
    const userId = btn.dataset.user;
    const collectionName = btn.dataset.collection;
    await approveEdit(editId, userId, collectionName);
}

// Reject handler
async function rejectClickHandler(e) {
    const btn = e.currentTarget;
    const editId = btn.dataset.id;
    await rejectEdit(editId);
}

async function approveEdit(editId, userId, collectionName) {
    const result = await Swal.fire({
        title: "Approve Request?",
        text: "This will apply the changes to the user's profile.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Approve",
        cancelButtonText: "Cancel"
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const editRef = doc(db, "pending_edits", editId);
        const editSnap = await getDoc(editRef);
        
        if (!editSnap.exists()) {
            Swal.fire("Error", "Request not found", "error");
            return;
        }
        
        const editData = editSnap.data();
        
        // Apply changes to user
        const userRef = doc(db, collectionName, userId);
        await updateDoc(userRef, editData.editData);
        
        // Mark as approved
        await updateDoc(editRef, { 
            status: "approved", 
            approvedAt: serverTimestamp(),
            approvedBy: JSON.parse(localStorage.getItem("currentUser"))?.fullName || "Admin"
        });
        
        // ========== ADD LOG HERE - AFTER SUCCESSFUL APPROVAL ==========
        await logEditAction(
            "approve_edit",
            editId,
            userId,
            editData.targetUser || userId,
            editData.userRole || "user",
            `Approved edit request: ${JSON.stringify(editData.editData)}`
        );
        // ===============================================================
        
        Swal.fire("Approved!", "Changes applied to user profile.", "success");
        await loadPendingEdits();
        
    } catch (err) {
        console.error("Error approving edit:", err);
        Swal.fire("Error", "Could not approve request", "error");
    }
}

async function rejectEdit(editId) {
    const result = await Swal.fire({
        title: "Reject Request?",
        text: "This will discard the requested changes.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Reject",
        cancelButtonText: "Cancel"
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const editRef = doc(db, "pending_edits", editId);
        const editSnap = await getDoc(editRef);
        
        if (!editSnap.exists()) {
            Swal.fire("Error", "Request not found", "error");
            return;
        }
        
        const editData = editSnap.data();
        
        // Mark as rejected
        await updateDoc(editRef, { 
            status: "rejected", 
            rejectedAt: serverTimestamp(),
            rejectedBy: JSON.parse(localStorage.getItem("currentUser"))?.fullName || "Admin"
        });
        
        // ========== ADD LOG HERE - AFTER SUCCESSFUL REJECTION ==========
        await logEditAction(
            "reject_edit",
            editId,
            editData.userId,
            editData.targetUser || editData.userId,
            editData.userRole || "user",
            `Rejected edit request for ${editData.userId}`
        );
        // ===============================================================
        
        Swal.fire("Rejected!", "Request has been rejected.", "success");
        await loadPendingEdits();
        
    } catch (err) {
        console.error("Error rejecting edit:", err);
        Swal.fire("Error", "Could not reject request", "error");
    }
}

// ======================= INITIALIZE ======================= //
document.addEventListener("DOMContentLoaded", async () => {
    await fetchLogHistory();
    await loadPendingEdits();  // ADD THIS LINE - Load pending edits
    setupSearch();
    setupModal();
    
    // Refresh logs every 30 seconds
    setInterval(fetchLogHistory, 30000);
    setInterval(loadPendingEdits, 10000); // Refresh pending edits every 10 seconds
});