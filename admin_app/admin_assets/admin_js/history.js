// ===================== ADMIN HISTORY FETCH (Grouped by Date + Merged Events + User Match + Filter) =====================
import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  const historyContainer = document.getElementById("history-list");
  const filterSelect = document.getElementById("filterSelect");

  let allData = {}; // Store all sessions grouped by date
  let usersByPlate = {}; // Store users

  async function loadAllHistory() {
    try {
      historyContainer.innerHTML = `
        <div class="loading-message">
          <div class="spinner"></div>
          <p>Loading all user activities...</p>
        </div>
      `;

      // --- 1️⃣ Fetch all collections (logs + users) ---
      const [gateSnap, roundSnap, parkSnap, userSnap] = await Promise.all([
        getDocs(collection(db, "gate_logs")),
        getDocs(collection(db, "roundabout")),
        getDocs(collection(db, "parked")),
        getDocs(collection(db, "users")),
      ]);

      // --- 2️⃣ Build user lookup by plate number ---
      usersByPlate = {};
      userSnap.forEach((doc) => {
        const user = doc.data();
        if (user.plateNumber) {
          usersByPlate[user.plateNumber.toUpperCase()] = user;
        }
      });

      // --- 3️⃣ Collect all events per plate ---
      const allEvents = {};

      const addEvent = (plate, event) => {
        if (!plate) return;
        const upperPlate = plate.toUpperCase();
        if (!allEvents[upperPlate]) allEvents[upperPlate] = [];
        allEvents[upperPlate].push(event);
      };

      // Gate events
      gateSnap.forEach((doc) => {
        const d = doc.data();
        const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        addEvent(d.plate_number, {
          type: "gate",
          eventType: d.event_type === "entry" ? "Entry" : "Exit",
          entry_time: ts,
          exit_time: null,
          duration_min: null,
          location: "Gate 3",
        });
      });

      // Roundabout events
      roundSnap.forEach((doc) => {
        const d = doc.data();
        addEvent(d.plate_number, {
          type: "roundabout",
          eventType: "Roundabout",
          entry_time: d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time),
          exit_time: d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time),
          duration_min: d.duration_min,
          location: "Roundabout",
        });
      });

      // Parked events
      parkSnap.forEach((doc) => {
        const d = doc.data();
        addEvent(d.plate_number, {
          type: "parked",
          eventType: "Parked",
          entry_time: d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time),
          exit_time: d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time),
          duration_min: d.duration_min,
          location: "Parking Area",
          slot: d.slot || "N/A",
        });
      });

      // --- 4️⃣ Merge sessions per plate ---
      const mergeSessions = (events) => {
        const gates = events.filter((e) => e.type === "gate").sort((a, b) => a.entry_time - b.entry_time);
        const others = events.filter((e) => e.type !== "gate").sort((a, b) => a.entry_time - b.entry_time);
        const merged = [];
        const usedOther = new Set();
        let i = 0;

        while (i < gates.length) {
          const gate = gates[i];
          if (gate.eventType === "Entry") {
            const nextExit = gates.find((g, idx) => idx > i && g.eventType === "Exit");
            const session = {
              entry_time: gate.entry_time,
              exit_time: nextExit?.entry_time || null,
              events: ["Entry"],
              location: gate.location,
              slot: null,
              duration_min: null,
            };

            others.forEach((e, j) => {
              if (usedOther.has(j)) return;
              const withinSession =
                e.entry_time >= session.entry_time &&
                (!session.exit_time || e.entry_time <= session.exit_time);
              if (withinSession) {
                session.events.push(e.eventType);
                if (e.slot) session.slot = e.slot;
                if (e.duration_min) session.duration_min = e.duration_min;
                usedOther.add(j);
              }
            });

            if (nextExit) session.events.push("Exit");
            merged.push(session);
            i = nextExit ? gates.indexOf(nextExit) + 1 : i + 1;
          } else i++;
        }

        // Add remaining unpaired events
        others.forEach((e, j) => {
          if (!usedOther.has(j)) merged.push(e);
        });

        return merged.sort((a, b) => b.entry_time - a.entry_time);
      };

      // --- 5️⃣ Group merged sessions by date ---
      allData = {};
      Object.keys(allEvents).forEach((plate) => {
        const sessions = mergeSessions(allEvents[plate]);

        sessions.forEach((session) => {
          const dateKey = session.entry_time.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          if (!allData[dateKey]) allData[dateKey] = [];
          allData[dateKey].push({ plate, ...session });
        });
      });

      renderHistory("all"); // initial view
    } catch (err) {
      console.error("Error loading all history:", err);
      historyContainer.innerHTML = `<p style="color:red;">Failed to load history: ${err.message}</p>`;
    }
  }

  // --- 🔍 Render Function (with filter support) ---
  function renderHistory(filterType) {
    const sortedDates = Object.keys(allData).sort((a, b) => new Date(b) - new Date(a));
    historyContainer.innerHTML = "";

    if (sortedDates.length === 0) {
      historyContainer.innerHTML = "<p>No history records found.</p>";
      return;
    }

    sortedDates.forEach((dateKey) => {
      let daySessions = allData[dateKey];

      // Apply filter
      if (filterType === "registered") {
        daySessions = daySessions.filter((i) => !!usersByPlate[i.plate]);
      } else if (filterType === "unregistered") {
        daySessions = daySessions.filter((i) => !usersByPlate[i.plate]);
      }

      // Skip empty results for this date
      if (daySessions.length === 0) return;

      // Sort (unregistered first, then latest)
      daySessions.sort((a, b) => {
        const aReg = !!usersByPlate[a.plate];
        const bReg = !!usersByPlate[b.plate];
        if (aReg !== bReg) return aReg ? 1 : -1;
        return b.entry_time - a.entry_time;
      });

      const section = document.createElement("div");
      section.className = "date-section";
      section.innerHTML = `<h2 class="date-title">${dateKey}</h2>`;

      daySessions.forEach((item) => {
        const entryTimeStr = item.entry_time?.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
        }) || "—";
        const exitTimeStr = item.exit_time
          ? item.exit_time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
          : null;
        const durationStr = item.duration_min
          ? (item.duration_min >= 60
              ? `${(item.duration_min / 60).toFixed(1)} hr`
              : `${Math.round(item.duration_min)} min`)
          : "";

        const userMatch = usersByPlate[item.plate];
        const isRegistered = !!userMatch;
        const userName = isRegistered
          ? `${userMatch.name || userMatch.fullName || "Registered User"}`
          : "Unregistered Vehicle";
        const plateHTML = isRegistered
          ? `<p><strong>Plate Number:</strong> ${item.plate}</p>`
          : `<p><strong>Plate Number:</strong> <span style="color:red;">${item.plate}</span></p>`;

        const div = document.createElement("div");
        div.className = "user";
        div.innerHTML = `
          <img src="${userMatch?.photoURL || "../../../../admin_assets/admin_img/default-avatar.svg"}">
          <div>
            <h2>${userName}</h2>
            ${plateHTML}
            <p>${item.events.join(" → ")}</p>
            <p><strong>Location:</strong> ${item.location}</p>
            ${item.slot ? `<p><strong>Slot:</strong> ${item.slot}</p>` : ""}
            <p><strong>Time:</strong> ${entryTimeStr}${exitTimeStr ? " → " + exitTimeStr : ""}</p>
            ${durationStr ? `<p><strong>Duration:</strong> ${durationStr}</p>` : ""}
          </div>
        `;
        section.appendChild(div);
      });

      historyContainer.appendChild(section);
    });
  }

  // --- 🎚 Filter Listener ---
  filterSelect.addEventListener("change", (e) => {
    renderHistory(e.target.value);
  });

  await loadAllHistory();
});
