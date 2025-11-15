// ========================= IMPORT FIREBASE ========================= //
import { db } from "../../../main_assets/js/authentication/firebase.js";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  setDoc,
  serverTimestamp,
  updateDoc,
  query,
  orderBy,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ========================= GLOBALS ========================= //
const notificationList = document.getElementById("notificationList");
const slotsRef = collection(db, "slots");
const notifRef = collection(db, "notifications");
const notifQuery = query(notifRef, orderBy("timestamp", "desc"));

// Get current user
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
if (!currentUser || !currentUser.idNumber) {
  document.documentElement.style.display = "none";
  window.location.href = "/index.html";
}
const userKey = currentUser.idNumber;

let lastStatus = {};

console.log("🔔 Ctrl+Park Notifications initialized...");

// ========================= Format Slot Name ========================= //
function formatSlotName(slotId) {
  if (!slotId) return "Unknown Slot";
  const parts = slotId.split("_");
  if (parts.length === 2 && !isNaN(parts[1])) {
    return `Slot ${parts[1]}`;
  }
  return slotId;
}

// ========================= Load Saved Notifications ========================= //
async function loadSavedNotifications() {
  try {
    const snapshot = await getDocs(notifQuery);
    notificationList.innerHTML = "";

    if (snapshot.empty) {
      notificationList.innerHTML = `<p>No notifications yet.</p>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const slot = data.slot || "Unknown Slot";
      const isRead = data.readBy?.[userKey] ?? false;

      addNotificationToUI(
        docSnap.id,
        slot,
        data.message || "",
        data.type || "info",
        data.timestamp,
        isRead
      );
    });
  } catch (err) {
    console.error("❌ Error loading saved notifications:", err);
  }
}

// ========================= Watch Slot Status ========================= //
onSnapshot(slotsRef, (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    const slotId = change.doc.id;
    const slotName = formatSlotName(slotId);
    const data = change.doc.data();
    const status = data.status || "Unknown";
    const prevStatus = lastStatus[slotId];

    if (prevStatus !== status) {
      const notifDocRef = doc(notifRef, slotId);

      try {
        const notifSnap = await getDoc(notifDocRef);
        const existingReadBy = notifSnap.exists() ? notifSnap.data().readBy || {} : {};

        await setDoc(
          notifDocRef,
          {
            slot: slotName,
            status: status,
            message: `${slotName} is now ${status.toUpperCase()}`,
            type: status === "Available" ? "available" : "info",
            timestamp: serverTimestamp(),
            readBy: existingReadBy // keep per-user read statuses
          },
          { merge: true }
        );

        lastStatus[slotId] = status;
        console.log(`💾 Notification updated for ${slotName}`);
      } catch (err) {
        console.error("❌ Error updating notification:", err);
      }
    }
  });
});

// ========================= Real-time Notifications ========================= //
onSnapshot(notifQuery, (snapshot) => {
  notificationList.innerHTML = "";

  if (snapshot.empty) {
    notificationList.innerHTML = `<p>No notifications yet.</p>`;
    return;
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const isRead = data.readBy?.[userKey] ?? false;

    const div = document.createElement("div");
    div.className = `notification-card ${data.type} ${isRead ? "read" : "unread"}`;

    const slotName = data.slot || "Unknown Slot";
    const message = data.message || "";
    const timestamp = data.timestamp?.toDate
      ? data.timestamp.toDate().toLocaleString()
      : new Date().toLocaleString();

    div.innerHTML = `
      <div class="notif-icon">
        <i class='bx ${data.type === "available" ? "bx-check-circle" : "bx-error"}'></i>
      </div>
      <div class="notif-content">
        <p><b>${slotName}</b>: ${message}</p>
        <small>${timestamp}</small>
      </div>
    `;

    // Mark as read on click (per user)
    div.addEventListener("click", async () => {
      const notifDoc = doc(db, "notifications", docSnap.id);
      const notifSnap = await getDoc(notifDoc);
      const currentReadBy = notifSnap.data().readBy || {};

      if (!currentReadBy[userKey]) {
        await updateDoc(notifDoc, { [`readBy.${userKey}`]: true });
        div.classList.remove("unread");
        div.classList.add("read");
      }
    });

    notificationList.prepend(div);
  });
});

// ========================= Add Notification to UI ========================= //
function addNotificationToUI(id, slot, message, type, timestamp, isRead) {
  const div = document.createElement("div");
  div.className = `notification-card ${type} ${isRead ? "read" : "unread"}`;

  const time = timestamp?.toDate ? timestamp.toDate().toLocaleString() : new Date().toLocaleString();

  div.innerHTML = `
    <div class="notif-icon">
      <i class='bx ${type === "available" ? "bx-check-circle" : "bx-error"}'></i>
    </div>
    <div class="notif-content">
      <p><b>${slot}</b>: ${message}</p>
      <small>${time}</small>
    </div>
  `;

  div.addEventListener("click", async () => {
    const notifDoc = doc(db, "notifications", id);
    const notifSnap = await getDoc(notifDoc);
    const currentReadBy = notifSnap.data().readBy || {};

    if (!currentReadBy[userKey]) {
      await updateDoc(notifDoc, { [`readBy.${userKey}`]: true });
      div.classList.remove("unread");
      div.classList.add("read");
    }
  });

  notificationList.prepend(div);
}

// ========================= Mark All as Read ========================= //
async function markAllAsRead() {
  const snapshot = await getDocs(notifRef);
  const updates = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const currentReadBy = data.readBy || {};
    if (!currentReadBy[userKey]) {
      updates.push(updateDoc(doc(db, "notifications", docSnap.id), { [`readBy.${userKey}`]: true }));
    }
  });

  await Promise.all(updates);

  // Update UI
  document.querySelectorAll(".notification-card.unread").forEach((el) => {
    el.classList.remove("unread");
    el.classList.add("read");
  });
}

// ========================= Initialize ========================= //
window.addEventListener("DOMContentLoaded", async () => {
  await loadSavedNotifications();

  const markAllBtn = document.getElementById("markAllBtn");
  if (markAllBtn) markAllBtn.addEventListener("click", markAllAsRead);
});
