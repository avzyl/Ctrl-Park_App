import { db } from "../../../main_assets/js/authentication/firebase.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ======================= LOAD REPORTS ======================= //
const reportTableBody = document.getElementById("reportTableBody");
const reportModal = document.getElementById("reportModal");
const closeModal = document.getElementById("closeModal");
const modalConcern = document.getElementById("modalConcern");
const modalUserName = document.getElementById("modalUserName");
const modalUserId = document.getElementById("modalUserId");
const modalPlate = document.getElementById("modalPlate");
const modalMessage = document.getElementById("modalMessage");
const conversationBox = document.getElementById("conversation");
const replyMessage = document.getElementById("replyMessage");
const sendReplyBtn = document.getElementById("sendReplyBtn");

let selectedReportId = null;
let selectedReportData = null;

async function loadReports() {
  const reportsRef = collection(db, "reports");
  const snapshot = await getDocs(reportsRef);
  reportTableBody.innerHTML = "";

  const reports = [];

  snapshot.forEach((docSnap) => {
    const report = docSnap.data();
    report.id = docSnap.id;
    reports.push(report);
  });

  // ✅ Sort unsolved reports first, solved ones last
  reports.sort((a, b) => {
    if ((a.status || "") === "solved" && (b.status || "") !== "solved") return 1;
    if ((b.status || "") === "solved" && (a.status || "") !== "solved") return -1;
    return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
  });

  reports.forEach((report) => createReportRow(report));
}

function createReportRow(report) {
  const tr = document.createElement("tr");
  tr.classList.add("clickable-row");
  tr.dataset.id = report.id;

  // ✅ Add green background if solved
  if (report.status === "solved") tr.classList.add("solved");

  tr.innerHTML = `
        <td>${report.name || "Unknown"}</td>
        <td>${report.program || "-"}</td>
        <td>${report.concernType || "-"}</td>
        <td>${report.plateNumber || "-"}</td>
        <td>${new Date(report.timestamp?.seconds * 1000).toLocaleString()}</td>
        <td>
            ${
              report.status === "solved"
                ? `<button class="solved-btn" disabled>✔ Solved</button>`
                : `<button class="solve-btn">Mark as Solved</button>`
            }
        </td>
    `;

  // Click to open modal
  tr.querySelectorAll("td:not(:last-child)").forEach((cell) => {
    cell.addEventListener("click", () => openModal(report.id, report));
  });

  // Solve button logic
  const solveBtn = tr.querySelector(".solve-btn");
  if (solveBtn) {
    solveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const reportRef = doc(db, "reports", report.id);
      await updateDoc(reportRef, { status: "solved" });
      tr.classList.add("solved");
      solveBtn.outerHTML = `<button class="solved-btn" disabled>✔ Solved</button>`;

      console.log(`✅ Report ${report.id} marked as solved.`);

      // ✅ Reload reports to reorder the table
      loadReports();
    });
  }

  reportTableBody.appendChild(tr);
}

// ======================= OPEN MODAL ======================= //
function openModal(reportId, report) {
  selectedReportId = reportId;
  selectedReportData = report;

  modalConcern.textContent = report.concernType || report.concern || "No concern title";
  modalUserName.textContent = report.name || "Unknown";
  modalUserId.textContent = report.userId || "-";
  modalPlate.textContent = report.plateNumber || "-";
  modalMessage.textContent = report.message || "-";

  // ✅ Show solved banner if report is marked solved
  const existingBanner = document.querySelector(".solved-banner");
  if (existingBanner) existingBanner.remove();

  if (report.status === "solved") {
    const banner = document.createElement("div");
    banner.className = "solved-banner";
    banner.innerHTML = `✅ This report has been <strong>marked as solved</strong>.`;
    document.querySelector(".modal-content").prepend(banner);
  }

  const conversation = report.conversation || [];
  conversationBox.innerHTML = conversation.length
    ? conversation
        .map(
          (msg) => `
        <div class="message ${msg.sender === "admin" ? "admin" : "user"}">
          <p>${msg.text}</p>
          <small>${new Date(msg.timestamp).toLocaleString()}</small>
        </div>
      `
        )
        .join("")
    : "<p class='no-messages'>No messages yet.</p>";

  reportModal.style.display = "flex";
}

// ======================= SEND REPLY ======================= //
sendReplyBtn.addEventListener("click", async () => {
  const text = replyMessage.value.trim();
  if (!text || !selectedReportId) return;

  const reportRef = doc(db, "reports", selectedReportId);
  const newMessage = {
    sender: "admin",
    text,
    timestamp: new Date().toISOString(),
  };

  try {
    await updateDoc(reportRef, {
      conversation: arrayUnion(newMessage),
    });

    replyMessage.value = "";
    selectedReportData.conversation = [
      ...(selectedReportData.conversation || []),
      newMessage,
    ];
    openModal(selectedReportId, selectedReportData);
  } catch (error) {
    console.error("❌ Error sending reply:", error);
  }
});

// ======================= CLOSE MODAL ======================= //
closeModal.addEventListener("click", () => {
  reportModal.style.display = "none";
});
window.addEventListener("click", (event) => {
  if (event.target === reportModal) {
    reportModal.style.display = "none";
  }
});

loadReports();