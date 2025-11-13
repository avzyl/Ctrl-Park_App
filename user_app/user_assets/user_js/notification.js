// ========================= IMPORT FIREBASE ========================= //
import { db } from "../../../main_assets/js/authentication/firebase.js";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  query,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const notificationList = document.getElementById("notificationList");
const slotsRef = collection(db, "slots");
const notifRef = collection(db, "notifications");

let lastStatus = {}; // Track last known slot status

console.log("🔔 Ctrl+Park Notifications initialized...");

// ========================= 1️⃣ Load Saved Notifications ========================= //
async function loadSavedNotifications() {
  try {
    const q = query(notifRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    notificationList.innerHTML = ""; // Clear placeholder

    if (snapshot.empty) {
      notificationList.innerHTML = `<p>No notifications yet.</p>`;
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      addNotificationToUI(data.slot, data.message, data.type, false);
    });
  } catch (err) {
    console.error("❌ Error loading saved notifications:", err);
  }
}

// ========================= 2️⃣ Watch for Slot Status Changes ========================= //
onSnapshot(slotsRef, (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    const data = change.doc.data();
    const slotName = change.doc.id;
    const currentStatus = data.status || "Unknown"; // ✅ Use the correct field
    const prevStatus = lastStatus[slotName];

    // Only trigger when status actually changes
    if (prevStatus && prevStatus !== currentStatus) {
      let message = "";
      let type = "";

      if (currentStatus === "Available") {
        message = "Slot is now AVAILABLE";
        type = "available";
      } else if (currentStatus === "Occupied") {
        message = "Slot has been OCCUPIED";
        type = "vacated";
      }

      if (message) {
        addNotificationToUI(slotName, message, type, true);
        await saveNotification(slotName, message, type);
      }
    }

    // Update last known status
    lastStatus[slotName] = currentStatus;
  });
});

// ========================= 3️⃣ Add Notification to UI ========================= //
function addNotificationToUI(slot, message, type, showPopup = true) {
  const div = document.createElement("div");
  div.className = `notification ${type}`;
  div.innerHTML = `
    <i class='bx ${type === "available" ? "bx-check-circle" : "bx-error"}'></i>
    <p><b>${slot}</b>: ${message}</p>
  `;

  // Prepend to the top of the list
  notificationList.prepend(div);

  if (showPopup) {
    Swal.fire({
      icon: type === "available" ? "success" : "info",
      title: message,
      text: `(${slot})`,
      timer: 2500,
      showConfirmButton: false
    });
  }
}

// ========================= 4️⃣ Save Notification to Firestore ========================= //
async function saveNotification(slot, message, type) {
  try {
    await addDoc(notifRef, {
      slot,
      message,
      type,
      timestamp: serverTimestamp()
    });
    console.log(`💾 Saved notification for ${slot}`);
  } catch (err) {
    console.error("❌ Error saving notification:", err);
  }
}

// ========================= 5️⃣ Initialize ========================= //
window.addEventListener("DOMContentLoaded", async () => {
  await loadSavedNotifications();
});
