import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  const historyContainer = document.getElementById("history-list");
  const filterSelect = document.getElementById("filterSelect");

  let slotHistory = []; // Store all slot history

  async function loadSlotHistory() {
    try {
      historyContainer.innerHTML = `<p>Loading all parking history...</p>`;

      const slotSnap = await getDocs(collection(db, "slot_history"));
      slotHistory = [];

      slotSnap.forEach((doc) => {
        const data = doc.data();

        let slotUser = null;
        try {
          slotUser = JSON.parse(data.user);
        } catch (err) {
          console.warn("Invalid user JSON in slot_history", data.user);
        }

        slotHistory.push({
          slot_number: data.slot_number,
          parked_time: data.parked_time?.toDate ? data.parked_time.toDate() : new Date(data.parked_time),
          vacate_time: data.vacate_time?.toDate ? data.vacate_time.toDate() : new Date(data.vacate_time),
          user: slotUser,
        });
      });

      renderSlotHistory("all");
    } catch (err) {
      console.error("Error fetching slot history:", err);
      historyContainer.innerHTML = `<p style="color:red;">Failed to load history: ${err.message}</p>`;
    }
  }

  function renderSlotHistory(filterType) {
    historyContainer.innerHTML = "";

    // Filter
    let filteredSlots = [...slotHistory];
    if (filterType === "registered") filteredSlots = filteredSlots.filter(s => s.user && s.user.fullName);
    if (filterType === "unregistered") filteredSlots = filteredSlots.filter(s => !s.user || !s.user.fullName);

    if (filteredSlots.length === 0) {
      historyContainer.innerHTML = "<p>No parking history found.</p>";
      return;
    }

    // Group by date
    const groupedSlots = {};
    filteredSlots.forEach(slotItem => {
      const dateKey = slotItem.parked_time.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
      if (!groupedSlots[dateKey]) groupedSlots[dateKey] = [];
      groupedSlots[dateKey].push(slotItem);
    });

    Object.keys(groupedSlots).sort((a, b) => new Date(b) - new Date(a)).forEach(dateKey => {
      const section = document.createElement("div");
      section.className = "date-section";
      section.innerHTML = `<h2 class="date-title">${dateKey}</h2>`;

      groupedSlots[dateKey].forEach(slotItem => {
        const entryTime = slotItem.parked_time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
        const exitTime = slotItem.vacate_time ? slotItem.vacate_time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "—";
        const duration = slotItem.vacate_time ? Math.round((slotItem.vacate_time - slotItem.parked_time)/60000) : 0;

        const slotUser = slotItem.user;
        const userName = slotUser?.fullName || "Unregistered Vehicle";
        const userPlate = slotUser?.plateNumber || "—";
        const userDept = slotUser?.department || "—";
        const userProgram = slotUser?.program || "—";
        const userPhoto = slotUser?.photoURL || "../../../../admin_assets/admin_img/default-avatar.svg";

        const div = document.createElement("div");
        div.className = "user";
        div.innerHTML = `
          <img src="${userPhoto}" alt="User Photo">
          <div>
            <h2>${userName}</h2>
            <p><strong>Plate Number:</strong> ${userPlate}</p>
            <p><strong>Department:</strong> ${userDept}</p>
            <p><strong>Program:</strong> ${userProgram}</p>
            <p><strong>Slot:</strong> ${slotItem.slot_number}</p>
            <p><strong>Time:</strong> ${entryTime} → ${exitTime}</p>
            ${duration ? `<p><strong>Duration:</strong> ${duration} min</p>` : ""}
          </div>
        `;
        section.appendChild(div);
      });

      historyContainer.appendChild(section);
    });
  }

  filterSelect.addEventListener("change", (e) => renderSlotHistory(e.target.value));
  await loadSlotHistory();
});
