import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, getDocs, updateDoc, doc, arrayUnion } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// DOM references
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

// ===================== LOAD REPORTS =====================
async function loadReports() {
  const reportsRef = collection(db, "reports");
  const snapshot = await getDocs(reportsRef);
  reportTableBody.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const report = docSnap.data();
    const tr = document.createElement("tr");
    tr.classList.add("clickable-row");
    tr.dataset.id = docSnap.id;

    tr.innerHTML = `
      <td>${report.name || "Unknown"}</td>
      <td>${report.program || "-"}</td>
      <td>${report.concernType || "-"}</td>
      <td>${report.plateNumber || "-"}</td>
      <td>${new Date(report.timestamp?.seconds * 1000 || Date.now()).toLocaleString()}</td>
    `;

    tr.addEventListener("click", () => openModal(docSnap.id, report));
    reportTableBody.appendChild(tr);
  });
}

// ===================== OPEN MODAL =====================
function openModal(reportId, report) {
  selectedReportId = reportId;
  selectedReportData = report; // ✅ now defined

  modalConcern.textContent = report.concernType || "-";
  modalUserName.textContent = report.name || "Unknown";
  modalUserId.textContent = report.userId || "-";
  modalPlate.textContent = report.plateNumber || "-";
  modalMessage.textContent = report.message || "-";

  const conversation = report.conversation || [];
  conversationBox.innerHTML = conversation.length
    ? conversation.map(msg => `
        <div class="message ${msg.sender === "admin" ? "admin" : "user"}">
          <p>${msg.text}</p>
          <small>${new Date(msg.timestamp).toLocaleString()}</small>
        </div>
      `).join("")
    : "<p class='no-messages'>No messages yet.</p>";

  reportModal.style.display = "flex"; // ✅ show centered
}

// ===================== SEND REPLY =====================
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

    // Update local view
    selectedReportData.conversation = [
      ...(selectedReportData.conversation || []),
      newMessage,
    ];

    openModal(selectedReportId, selectedReportData);
    console.log("✅ Reply sent successfully!");
  } catch (error) {
    console.error("❌ Error sending reply:", error);
  }
});

// ===================== CLOSE MODAL =====================
closeModal.addEventListener("click", () => {
  reportModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === reportModal) {
    reportModal.style.display = "none";
  }
});

// ===================== INITIALIZE =====================
loadReports();