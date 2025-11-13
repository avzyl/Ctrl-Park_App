import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ======================= LOAD REPORTS ======================= //
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
const reportList = document.getElementById("reportList");
const reportModal = document.getElementById("reportModal");
const closeModal = document.getElementById("closeModal");
const modalConcern = document.getElementById("modalConcern");
const modalStatus = document.getElementById("modalStatus");
const conversationBox = document.getElementById("conversation");
const replyMessage = document.getElementById("replyMessage");
const sendReplyBtn = document.getElementById("sendReplyBtn");

let selectedReportId = null;
let selectedReportData = null;

// Floating + button
document.getElementById("addReportBtn").addEventListener("click", () => {
  window.location.href = "./add_report.html";
});

async function loadReports() {
  if (!currentUser) {
    reportList.innerHTML = "<p>Please log in to view your reports.</p>";
    return;
  }

  const userId = String(currentUser.idNumber || "Unknown");
  reportList.innerHTML = "<p>Loading your reports...</p>";

  try {
    const q = query(
      collection(db, "reports"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      reportList.innerHTML = "<p>No reports found.</p>";
      return;
    }

    reportList.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const date = data.timestamp?.toDate
        ? data.timestamp.toDate().toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "No timestamp";

      const div = document.createElement("div");
      div.className = "report-card";
      div.innerHTML = `
        <div class="report-header">
          <h4>${data.concernType}</h4>
          <small>${date}</small>
        </div>
        <p>${data.message}</p>
        <p><strong>Plate:</strong> ${data.plateNumber || "Unknown"}</p>
        <p><strong>Status:</strong> ${data.status || "Pending"}</p>
      `;

      // Make each report clickable
      div.addEventListener("click", () => openModal(docSnap.id, data));
      reportList.appendChild(div);
    });
  } catch (err) {
    console.error("❌ Error loading reports:", err);
    reportList.innerHTML = "<p>Error loading reports.</p>";
  }
}

// ======================= REPORT MODAL ======================= //
function openModal(reportId, report) {
  selectedReportId = reportId;
  selectedReportData = report;

  modalConcern.textContent = report.concernType;
  modalStatus.textContent = report.status || "Pending";

  // Clear old content
  conversationBox.innerHTML = "";

  if (report.status === "solved") {
    const solvedBanner = document.createElement("div");
    solvedBanner.className = "solved-banner";
    solvedBanner.innerHTML = `
      ✅ <strong>This report has been marked as solved by the admin.</strong>
    `;
    conversationBox.appendChild(solvedBanner);
  }

  // Conversation messages
  const conversation = report.conversation || [];
  if (conversation.length) {
    conversation.forEach((msg) => {
      const msgDiv = document.createElement("div");
      msgDiv.className = `message ${msg.sender === "admin" ? "admin" : "user"}`;
      msgDiv.innerHTML = `
        <p>${msg.text}</p>
        <small>${new Date(msg.timestamp).toLocaleString()}</small>
      `;
      conversationBox.appendChild(msgDiv);
    });
  } else {
    const noMsg = document.createElement("p");
    noMsg.className = "no-messages";
    noMsg.textContent = "No messages yet.";
    conversationBox.appendChild(noMsg);
  }

  reportModal.style.display = "flex";
}

// ======================= SEND REPLY ======================= //
sendReplyBtn.addEventListener("click", async () => {
  const text = replyMessage.value.trim();
  if (!text || !selectedReportId) return;

  const reportRef = doc(db, "reports", selectedReportId);
  const newMessage = {
    sender: "user",
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
    Swal.fire("Sent!", "Your reply has been sent successfully.", "success");
  } catch (error) {
    console.error("❌ Error sending reply:", error);
    Swal.fire("Error", "Could not send your reply.", "error");
  }
});

// close modal
closeModal.addEventListener("click", () => (reportModal.style.display = "none"));
window.addEventListener("click", (e) => {
  if (e.target === reportModal) reportModal.style.display = "none";
});

// init
document.addEventListener("DOMContentLoaded", loadReports);
