import { db } from "../../../main_assets/js/authentication/firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ======================= GLOBALS ======================= //
let allLogs = [];
let currentSearchTerm = "";
let currentActionFilter = "all";
let currentStartDate = "";
let currentEndDate = "";
let currentSortField = "timestamp";
let currentSortDirection = "desc";

// Action display names and colors
const actionConfig = {
    "pending_edit": { label: "Pending Edit Request", color: "#ffc107" },
    "approved_edit": { label: "Approved Edit Request", color: "#28a745" },
    "rejected_edit": { label: "Rejected Edit Request", color: "#dc3545" },
    "deactivated": { label: "Deactivated User", color: "#ffc107" },
    "activated": { label: "Activated User", color: "#17a2b8" },
    "reactivated": { label: "Reactivated User", color: "#fd7e14" },
    "soft_deleted": { label: "Soft Deleted User", color: "#6c757d" },
    "registered_admin": { label: "Registered Admin", color: "#4f46e5" },
    "registered_driver": { label: "Registered Driver", color: "#28a745" },
    "registered_passenger": { label: "Registered Passenger", color: "#17a2b8" }
};

// ======================= FETCH ALL LOGS ======================= //
async function fetchAllLogs() {
    try {
        const logs = [];
        
        // 1. Fetch pending_edits collection
        const pendingEditsRef = collection(db, "pending_edits");
        const pendingSnapshot = await getDocs(query(pendingEditsRef, orderBy("requestedAt", "desc")));
        
        pendingSnapshot.forEach(doc => {
            const data = doc.data();
            const editFields = Object.keys(data.editData || {}).join(", ");
            
            logs.push({
                id: doc.id,
                type: "pending_edit",
                requestedBy: data.requestedBy || "-",
                status: data.status || "pending",
                approvedBy: data.approvedBy || "-",
                timestamp: data.requestedAt,
                details: `Requested to change: ${editFields}`,
                targetUser: data.userId,
                changes: data.editData
            });
        });
        
        // 2. Fetch approved/rejected edits from pending_edits with status approved/rejected
        const approvedEditsRef = collection(db, "pending_edits");
        const approvedSnapshot = await getDocs(query(approvedEditsRef, where("status", "in", ["approved", "rejected"])));
        
        approvedSnapshot.forEach(doc => {
            const data = doc.data();
            const editFields = Object.keys(data.editData || {}).join(", ");
            
            logs.push({
                id: doc.id,
                type: data.status === "approved" ? "approved_edit" : "rejected_edit",
                requestedBy: data.requestedBy || "-",
                status: data.status,
                approvedBy: data.approvedBy || "-",
                timestamp: data.approvedAt || data.rejectedAt || data.requestedAt,
                details: `${data.status === "approved" ? "Approved" : "Rejected"} request to change: ${editFields}`,
                targetUser: data.userId,
                changes: data.editData
            });
        });
        
        // 3. Fetch admin_action_logs for user status changes
        const actionLogsRef = collection(db, "admin_action_logs");
        const actionSnapshot = await getDocs(query(actionLogsRef, orderBy("timestamp", "desc")));
        
        actionSnapshot.forEach(doc => {
            const data = doc.data();
            let type = "";
            
            if (data.action === "deactivate") type = "deactivated";
            else if (data.action === "activate") type = "activated";
            else if (data.action === "reactivate") type = "reactivated";
            else if (data.action === "soft_delete") type = "soft_deleted";
            else if (data.action === "register_admin") type = "registered_admin";
            else if (data.action === "register_driver") type = "registered_driver";
            else if (data.action === "register_passenger") type = "registered_passenger";
            else if (data.action === "approve_user") type = "approved_edit";
            
            if (type) {
                logs.push({
                    id: doc.id,
                    type: type,
                    requestedBy: data.adminName || "-",
                    status: "completed",
                    approvedBy: data.adminName || "-",
                    timestamp: data.timestamp,
                    details: data.details || `${type} user`,
                    targetUser: data.targetUser || data.targetId,
                    changes: data.changes || {}
                });
            }
        });
        
        // Sort all logs by timestamp (newest first)
        logs.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });
        
        allLogs = logs;
        renderLogsTable();
        
    } catch (err) {
        console.error("Error fetching logs:", err);
        const tbody = document.getElementById("logsTableBody");
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading logs: ' + err.message + '</td></tr>';
        }
    }
}

// ======================= FILTER LOGS ======================= //
function filterLogs() {
    let filtered = [...allLogs];
    
    // Search filter
    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        filtered = filtered.filter(log => 
            (log.requestedBy && log.requestedBy.toLowerCase().includes(term)) ||
            (log.approvedBy && log.approvedBy.toLowerCase().includes(term)) ||
            (log.targetUser && log.targetUser.toLowerCase().includes(term)) ||
            (log.details && log.details.toLowerCase().includes(term))
        );
    }
    
    // Action filter
    if (currentActionFilter !== "all") {
        filtered = filtered.filter(log => log.type === currentActionFilter);
    }
    
    // Date range filter
    if (currentStartDate) {
        const startDateTime = new Date(currentStartDate).setHours(0, 0, 0, 0);
        filtered = filtered.filter(log => {
            const logTime = log.timestamp?.toMillis ? log.timestamp.toMillis() : 0;
            return logTime >= startDateTime;
        });
    }
    
    if (currentEndDate) {
        const endDateTime = new Date(currentEndDate).setHours(23, 59, 59, 999);
        filtered = filtered.filter(log => {
            const logTime = log.timestamp?.toMillis ? log.timestamp.toMillis() : 0;
            return logTime <= endDateTime;
        });
    }
    
    // Sort
    filtered.sort((a, b) => {
        let aVal, bVal;
        
        switch(currentSortField) {
            case "requestedBy":
                aVal = a.requestedBy || "";
                bVal = b.requestedBy || "";
                break;
            case "type":
                aVal = actionConfig[a.type]?.label || a.type;
                bVal = actionConfig[b.type]?.label || b.type;
                break;
            case "targetUser":
                aVal = a.targetUser || "";
                bVal = b.targetUser || "";
                break;
            case "details":
                aVal = a.details || "";
                bVal = b.details || "";
                break;
            case "timestamp":
                aVal = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                bVal = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                break;
            default:
                aVal = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                bVal = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        }
        
        if (currentSortDirection === "asc") {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    return filtered;
}

// ======================= RENDER LOGS TABLE ======================= //
function renderLogsTable() {
    const tbody = document.getElementById("logsTableBody");
    if (!tbody) return;
    
    const filtered = filterLogs();
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No logs found. Perform admin actions to see logs here.</td></tr>';
        return;
    }
    
    tbody.innerHTML = "";
    
    filtered.forEach(log => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        
        const actionInfo = actionConfig[log.type] || { label: log.type, color: "#6c757d" };
        const timestamp = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : "-";
        
        // Determine display values based on log type
        let requestedByDisplay = log.requestedBy;
        let approvedByDisplay = log.approvedBy;
        
        if (log.type === "deactivated" || log.type === "activated" || log.type === "reactivated" || log.type === "soft_deleted") {
            requestedByDisplay = log.approvedBy;
            approvedByDisplay = "-";
        }
        
        if (log.type === "registered_admin" || log.type === "registered_driver" || log.type === "registered_passenger") {
            requestedByDisplay = log.approvedBy;
            approvedByDisplay = "-";
        }
        
        row.innerHTML = `
            <td><strong>${log.type === "pending_edit" ? "📝 Pending" : actionInfo.label}</strong><br>
                <small style="font-size: 10px; color: #666;">Requested by: ${requestedByDisplay || "-"}</small>
            </td>
            <td>${log.targetUser || "-"}</td>
            <td>${log.details || "-"}将
            <td>${approvedByDisplay !== "-" ? `Approved by: ${approvedByDisplay}` : "-"}</td>
            <td>${timestamp}</td>
        `;
        
        row.addEventListener("click", () => showLogDetails(log));
        tbody.appendChild(row);
    });
}

// ======================= SHOW LOG DETAILS MODAL ======================= //
function showLogDetails(log) {
    const modal = document.getElementById("logDetailModal");
    const body = document.getElementById("logDetailBody");
    
    const actionInfo = actionConfig[log.type] || { label: log.type, color: "#6c757d" };
    const timestamp = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : "-";
    
    let changesHtml = "";
    if (log.changes && Object.keys(log.changes).length > 0) {
        changesHtml = `
            <div style="margin-bottom: 15px;">
                <strong>Changes Made:</strong><br>
                <div style="background: #e8f0fe; padding: 10px; border-radius: 8px; margin-top: 5px; font-family: monospace; font-size: 12px;">
                    ${JSON.stringify(log.changes, null, 2)}
                </div>
            </div>
        `;
    }
    
    body.innerHTML = `
        <div style="padding: 10px;">
            <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <strong>Action:</strong> <span class="action-badge" style="background: ${actionInfo.color}; padding: 4px 10px; border-radius: 20px; color: white;">${actionInfo.label}</span>
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Requested By:</strong> ${log.requestedBy || "-"}<br>
                <strong>Approved/Processed By:</strong> ${log.approvedBy || "-"}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Target User:</strong> ${log.targetUser || "-"}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Details:</strong><br>
                <div style="background: #f1f1f1; padding: 10px; border-radius: 8px; margin-top: 5px;">
                    ${log.details || "-"}
                </div>
            </div>
            ${changesHtml}
            <div style="margin-bottom: 15px;">
                <strong>Timestamp:</strong> ${timestamp}
            </div>
        </div>
    `;
    
    modal.classList.add("active");
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
    
    renderLogsTable();
}

// ======================= SEARCH FUNCTIONALITY ======================= //
function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const clearBtn = document.getElementById("clearBtn");
    const actionFilter = document.getElementById("actionFilter");
    const startDateFilter = document.getElementById("startDateFilter");
    const endDateFilter = document.getElementById("endDateFilter");
    
    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            currentSearchTerm = searchInput ? searchInput.value.trim() : "";
            currentActionFilter = actionFilter ? actionFilter.value : "all";
            currentStartDate = startDateFilter ? startDateFilter.value : "";
            currentEndDate = endDateFilter ? endDateFilter.value : "";
            renderLogsTable();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (actionFilter) actionFilter.value = "all";
            if (startDateFilter) startDateFilter.value = "";
            if (endDateFilter) endDateFilter.value = "";
            currentSearchTerm = "";
            currentActionFilter = "all";
            currentStartDate = "";
            currentEndDate = "";
            renderLogsTable();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                currentSearchTerm = searchInput.value.trim();
                currentActionFilter = actionFilter ? actionFilter.value : "all";
                currentStartDate = startDateFilter ? startDateFilter.value : "";
                currentEndDate = endDateFilter ? endDateFilter.value : "";
                renderLogsTable();
            }
        });
    }
    
    if (actionFilter) {
        actionFilter.addEventListener("change", () => {
            currentActionFilter = actionFilter.value;
            renderLogsTable();
        });
    }
    
    if (startDateFilter) {
        startDateFilter.addEventListener("change", () => {
            currentStartDate = startDateFilter.value;
            renderLogsTable();
        });
    }
    
    if (endDateFilter) {
        endDateFilter.addEventListener("change", () => {
            currentEndDate = endDateFilter.value;
            renderLogsTable();
        });
    }
}

// ======================= MODAL SETUP ======================= //
function setupModal() {
    const modal = document.getElementById("logDetailModal");
    const closeBtn = document.getElementById("closeDetailModalBtn");
    
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

// ======================= SORT HEADERS ======================= //
function setupSortHeaders() {
    const sortAdmin = document.getElementById("sortAdmin");
    const sortAction = document.getElementById("sortAction");
    const sortTarget = document.getElementById("sortTarget");
    const sortDetails = document.getElementById("sortDetails");
    const sortTime = document.getElementById("sortTime");
    
    if (sortAdmin) sortAdmin.addEventListener("click", () => sortBy("requestedBy"));
    if (sortAction) sortAction.addEventListener("click", () => sortBy("type"));
    if (sortTarget) sortTarget.addEventListener("click", () => sortBy("targetUser"));
    if (sortDetails) sortDetails.addEventListener("click", () => sortBy("details"));
    if (sortTime) sortTime.addEventListener("click", () => sortBy("timestamp"));
}

// ======================= CREATE SAMPLE DATA ======================= //
async function createSampleData() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    const samples = [
        {
            collection: "pending_edits",
            data: {
                userId: "DRV00123",
                requestedBy: "John Doe",
                requestedAt: serverTimestamp(),
                status: "pending",
                editData: { plateNumber: "ABC-1234", vehicle: "Toyota Vios" }
            }
        },
        {
            collection: "pending_edits",
            data: {
                userId: "DRV00100",
                requestedBy: "Jane Smith",
                requestedAt: serverTimestamp(),
                status: "approved",
                approvedBy: currentUser.fullName,
                approvedAt: serverTimestamp(),
                editData: { vehicle: "Honda Civic" }
            }
        },
        {
            collection: "admin_action_logs",
            data: {
                action: "reactivate",
                adminName: currentUser.fullName,
                targetUser: "Mark Johnson",
                details: "Reactivated user account after 4 months",
                timestamp: serverTimestamp()
            }
        },
        {
            collection: "admin_action_logs",
            data: {
                action: "deactivate",
                adminName: currentUser.fullName,
                targetUser: "Sarah Wilson",
                details: "Deactivated user account",
                timestamp: serverTimestamp()
            }
        }
    ];
    
    for (const sample of samples) {
        const docRef = doc(db, sample.collection, `sample_${Date.now()}_${Math.random()}`);
        await setDoc(docRef, sample.data);
    }
    
    await fetchAllLogs();
    Swal.fire("Success!", "Sample logs created successfully.", "success");
}

// ======================= ADD SAMPLE BUTTON ======================= //
function addSampleButton() {
    const searchSection = document.querySelector(".search-section");
    if (searchSection && !document.getElementById("createSampleBtn")) {
        const sampleBtn = document.createElement("button");
        sampleBtn.id = "createSampleBtn";
        sampleBtn.className = "clear-search-btn";
        sampleBtn.style.background = "#28a745";
        sampleBtn.addEventListener("click", createSampleData);
        searchSection.appendChild(sampleBtn);
    }
}

// ======================= INITIALIZE ======================= //
document.addEventListener("DOMContentLoaded", async () => {
    await fetchAllLogs();
    setupSearch();
    setupModal();
    setupSortHeaders();
    addSampleButton();
    
    // Refresh logs every 30 seconds
    setInterval(fetchAllLogs, 30000);
});