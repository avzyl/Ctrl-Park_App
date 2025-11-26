import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ======================= LOAD TODAY'S HISTORY ======================= //
document.addEventListener("DOMContentLoaded", async () => {
  const recentContainer = document.querySelector(".recent-activity");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!recentContainer || !currentUser?.plateNumber) {
    console.warn("Missing user or recent container");
    return;
  }

  const plateNumber = currentUser.plateNumber;

  async function loadRecentEvents() {
    try {
      recentContainer.innerHTML = `
        <div class="loading-message">
          <div class="spinner"></div>
          <p>Loading today's recent activity...</p>
        </div>
      `;

      // Firestore refs
      const gateRef = collection(db, "gate_logs");
      const roundRef = collection(db, "roundabout");
      const slotHistoryRef = collection(db, "slot_history");

      const [gateSnap, roundSnap, slotSnap] = await Promise.all([
        getDocs(query(gateRef, where("plate_number", "==", plateNumber))),
        getDocs(query(roundRef, where("plate_number", "==", plateNumber))),
        getDocs(slotHistoryRef)
      ]);

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const isToday = ts => {
        let d = ts?.toDate ? ts.toDate() : new Date(ts);
        return d >= startOfDay && d < endOfDay;
      };

      // --- STEP 1: Merge Gate Entry & Exit ---
      const gateEntries = [];
      const gateExits = [];
      gateSnap.forEach(doc => {
        const d = doc.data();
        if (!isToday(d.timestamp)) return;
        if (d.event_type === "entry") gateEntries.push(d);
        else if (d.event_type === "exit") gateExits.push(d);
      });

      const journeys = [];

      gateEntries.forEach(entry => {
        const entryTime = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
        const matchingExit = gateExits.find(exit => {
          const exitTime = exit.timestamp?.toDate ? exit.timestamp.toDate() : new Date(exit.timestamp);
          const diffMin = (exitTime - entryTime) / 60000;
          return diffMin > 0 && diffMin <= 240; // within 4 hours
        });

        const exitTime = matchingExit ? (matchingExit.timestamp?.toDate ? matchingExit.timestamp.toDate() : new Date(matchingExit.timestamp)) : null;

        journeys.push({
          gateEntry: entryTime,
          gateExit: exitTime,
          parkedTime: null,
          slot: null,
          type: "gate_only"
        });

        if (matchingExit) {
          // Remove used exit
          const index = gateExits.indexOf(matchingExit);
          if (index >= 0) gateExits.splice(index, 1);
        }
      });

      // --- STEP 2: Merge Slot History (parking) ---
      slotSnap.forEach(doc => {
        const d = doc.data();
        if (!d.user) return;
        let userObj;
        try { userObj = JSON.parse(d.user); } catch { return; }
        if (userObj.idNumber !== currentUser.idNumber) return;

        const parkedTimeStart = d.parked_time?.toDate ? d.parked_time.toDate() : new Date(d.parked_time);
        const parkedTimeEnd = d.vacate_time?.toDate ? d.vacate_time.toDate() : new Date(d.vacate_time);

        if (!isToday(parkedTimeStart)) return;

        // Find the gate entry that matches this parked session
        const journey = journeys.find(j => {
          const ge = j.gateEntry.getTime();
          const gx = j.gateExit ? j.gateExit.getTime() : ge + 4 * 60 * 60 * 1000;
          return parkedTimeStart >= ge && parkedTimeEnd <= gx;
        });

        if (journey) {
          journey.parkedTime = { start: parkedTimeStart, end: parkedTimeEnd };
          journey.slot = d.slot_number || "N/A";
          journey.type = "parked";
        }
      });

      // --- STEP 3: Merge Roundabout-only trips ---
      roundSnap.forEach(doc => {
        const d = doc.data();
        if (!isToday(d.timestamp)) return;
        const entry_time = d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time);
        const exit_time = d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time);

        // Check if it fits any existing journey
        const overlap = journeys.find(j => {
          const ge = j.gateEntry.getTime();
          const gx = j.gateExit ? j.gateExit.getTime() : ge + 4 * 60 * 60 * 1000;
          return entry_time >= ge && exit_time <= gx;
        });
        if (!overlap) {
          journeys.push({
            gateEntry: entry_time, // approximates entry
            gateExit: exit_time,
            parkedTime: { start: entry_time, end: exit_time },
            slot: null,
            type: "roundabout"
          });
        }
      });

      // --- STEP 4: Sort by latest gate exit ---
      journeys.sort((a, b) => {
        const aTime = a.gateExit || a.gateEntry;
        const bTime = b.gateExit || b.gateEntry;
        return bTime - aTime;
      });

      recentContainer.innerHTML = "";

      if (!journeys.length) {
        recentContainer.innerHTML = "<p>No activity recorded today.</p>";
        return;
      }

      journeys.slice(0, 5).forEach(j => {
        const gateEntry = j.gateEntry?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || "—";
        const gateExit = j.gateExit?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || "—";
        const parkedStart = j.parkedTime?.start?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || null;
        const parkedEnd = j.parkedTime?.end?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || null;

        const durationMin = ((j.gateExit || j.parkedTime?.end) - j.gateEntry) / 60000;
        const duration = durationMin >= 60 ? `${(durationMin / 60).toFixed(1)} hr` : `${Math.round(durationMin)} min`;

        const card = document.createElement("div");
        card.className = "recent-card fade-in";
        card.innerHTML = `
          <div class="card-header">
            <h4>${j.type === "parked" ? "Parked" : j.type === "roundabout" ? "Roundabout" : "Journey"}</h4>
            <span class="timestamp">${gateExit}</span>
          </div>
          <div class="card-body">
            <p><strong>Location:</strong> ${j.type === "parked" ? "Parking Area" : "Roundabout / Gate"}</p>
            ${j.slot ? `<p><strong>Slot:</strong> ${j.slot}</p>` : ""}
            <p><strong>Gate Entry:</strong> ${gateEntry}</p>
            ${j.parkedTime ? `<p><strong>${j.type === "parked" ? "Parked Time" : "Trip Time"}:</strong> ${parkedStart} – ${parkedEnd}</p>` : ""}
            <p><strong>Gate Exit:</strong> ${gateExit}</p>
            <p><strong>Total Duration:</strong> ${duration}</p>
          </div>
        `;
        recentContainer.appendChild(card);
      });

    } catch (err) {
      console.error("Failed to load recent events:", err);
      recentContainer.innerHTML = "<p style='color:red;'>Failed to load recent events.</p>";
    }
  }

  await loadRecentEvents();
  setInterval(loadRecentEvents, 30000);
});

//========================= MONTHLY ======================//
document.addEventListener("DOMContentLoaded", async () => {
  const monthlyContainer = document.querySelector(".monthly-activity");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!monthlyContainer || !currentUser?.plateNumber) {
    console.warn("Missing user or container");
    return;
  }

  const plateNumber = currentUser.plateNumber;

  async function loadMonthlyHistory() {
    try {
      monthlyContainer.innerHTML = `
        <div class="loading-message">
          <div class="spinner"></div>
          <p>Loading activity history...</p>
        </div>
      `;

      const gateRef = collection(db, "gate_logs");
      const roundRef = collection(db, "roundabout");
      const slotHistoryRef = collection(db, "slot_history");

      const [gateSnap, roundSnap, slotSnap] = await Promise.all([
        getDocs(query(gateRef, where("plate_number", "==", plateNumber))),
        getDocs(query(roundRef, where("plate_number", "==", plateNumber))),
        getDocs(slotHistoryRef)
      ]);

      const today = new Date();

      // --- STEP 1: Build journeys from gate logs ---
      const gateEntries = [];
      const gateExits = [];
      gateSnap.forEach(doc => {
        const d = doc.data();
        if (d.event_type === "entry") gateEntries.push(d);
        else if (d.event_type === "exit") gateExits.push(d);
      });

      const journeys = [];
      gateEntries.forEach(entry => {
        const entryTime = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
        const matchingExit = gateExits.find(exit => {
          const exitTime = exit.timestamp?.toDate ? exit.timestamp.toDate() : new Date(exit.timestamp);
          const diffMin = (exitTime - entryTime) / 60000;
          return diffMin > 0 && diffMin <= 240;
        });
        const exitTime = matchingExit ? (matchingExit.timestamp?.toDate ? matchingExit.timestamp.toDate() : new Date(matchingExit.timestamp)) : null;

        journeys.push({
          gateEntry: entryTime,
          gateExit: exitTime,
          parkedTime: null,
          slot: null,
          type: "gate_only"
        });

        if (matchingExit) {
          const index = gateExits.indexOf(matchingExit);
          if (index >= 0) gateExits.splice(index, 1);
        }
      });

      // --- STEP 2: Merge slot history ---
      slotSnap.forEach(doc => {
        const d = doc.data();
        if (!d.user) return;
        let userObj;
        try { userObj = JSON.parse(d.user); } catch { return; }
        if (userObj.idNumber !== currentUser.idNumber) return;

        const parkedStart = d.parked_time?.toDate ? d.parked_time.toDate() : new Date(d.parked_time);
        const parkedEnd = d.vacate_time?.toDate ? d.vacate_time.toDate() : new Date(d.vacate_time);

        const journey = journeys.find(j => {
          const ge = j.gateEntry.getTime();
          const gx = j.gateExit ? j.gateExit.getTime() : ge + 4 * 60 * 60 * 1000;
          return parkedStart >= ge && parkedEnd <= gx;
        });

        if (journey) {
          journey.parkedTime = { start: parkedStart, end: parkedEnd };
          journey.slot = d.slot_number || "N/A";
          journey.type = "parked";
        }
      });

      // --- STEP 3: Merge roundabout-only trips ---
      roundSnap.forEach(doc => {
        const d = doc.data();
        const entry_time = d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time);
        const exit_time = d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time);

        // Skip if already covered by a gate session
        const hasGateSession = journeys.some(j => {
          const ge = j.gateEntry.getTime();
          const gx = j.gateExit ? j.gateExit.getTime() : ge + 4 * 60 * 60 * 1000;
          return entry_time >= ge && exit_time <= gx;
        });

        if (!hasGateSession) {
          journeys.push({
            gateEntry: entry_time,
            gateExit: exit_time,
            parkedTime: { start: entry_time, end: exit_time },
            slot: null,
            type: "roundabout"
          });
        }
      });

      // --- STEP 4: Group by day ---
      const grouped = {};
      const dateLabel = d => {
        if (d.toDateString() === today.toDateString()) return "Today";
        return d.toLocaleDateString("en-PH", { dateStyle: "medium" });
      };

      journeys.forEach(j => {
        const label = dateLabel(j.gateEntry);
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(j);
      });

      // --- STEP 5: Sort entries descending ---
      Object.values(grouped).forEach(arr => arr.sort((a, b) => {
        const aTime = a.gateExit || a.gateEntry;
        const bTime = b.gateExit || b.gateEntry;
        return bTime - aTime;
      }));

      // --- STEP 6: Render with Today first ---
      monthlyContainer.innerHTML = "";

      // Filter journeys to only parked or roundabout
      const displayJourneys = journeys.filter(j => j.type === "parked" || j.type === "roundabout");

      if (!displayJourneys.length) {
        monthlyContainer.innerHTML = "<p>No activity recorded.</p>";
        return;
      }

      const sortedLabels = Object.keys(grouped)
        .filter(label => grouped[label].some(j => j.type === "parked" || j.type === "roundabout"))
        .sort((a, b) => {
          if (a === "Today") return -1;
          if (b === "Today") return 1;
          return new Date(b) - new Date(a);
        });

      sortedLabels.forEach(label => {
        const header = document.createElement("h4");
        header.textContent = label;
        header.style.marginTop = "20px";
        monthlyContainer.appendChild(header);

        grouped[label]
          .filter(j => j.type === "parked" || j.type === "roundabout")
          .forEach(j => {
            const gateEntry = j.gateEntry?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || "—";
            const gateExit = j.gateExit?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || "—";
            const parkedStart = j.parkedTime?.start?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || null;
            const parkedEnd = j.parkedTime?.end?.toLocaleTimeString("en-PH", { timeStyle: "short" }) || null;

            const durationMin = ((j.gateExit || j.parkedTime?.end) - j.gateEntry) / 60000;
            const duration = durationMin >= 60 ? `${(durationMin / 60).toFixed(1)} hr` : `${Math.round(durationMin)} min`;

            const div = document.createElement("div");
            div.className = "monthly-card fade-in";
            div.innerHTML = `
              <div class="card-header">
                <h4>${j.type === "parked" ? "Parked" : "Roundabout"}</h4>
                <span class="timestamp">${gateExit}</span>
              </div>
              <div class="card-body">
                <p><strong>Location:</strong> ${j.type === "parked" ? "Parking Area" : "Roundabout / Gate"}</p>
                ${j.slot ? `<p><strong>Slot:</strong> ${j.slot}</p>` : ""}
                <p><strong>Gate Entry:</strong> ${gateEntry}</p>
                ${j.parkedTime ? `<p><strong>${j.type === "parked" ? "Parked Time" : "Trip Time"}:</strong> ${parkedStart} – ${parkedEnd}</p>` : ""}
                <p><strong>Gate Exit:</strong> ${gateExit}</p>
                <p><strong>Total Duration:</strong> ${duration}</p>
              </div>
            `;
            monthlyContainer.appendChild(div);
          });
      });

    } catch (err) {
      console.error("Failed to load history:", err);
      monthlyContainer.innerHTML = "<p style='color:red;'>Failed to load history.</p>";
    }
  }

  await loadMonthlyHistory();
});


//========================= STATS ======================//
document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser?.plateNumber) return;

  const plateNumber = currentUser.plateNumber;

  // Grab the stats elements
  const entriesCount = document.getElementById("entriesCount");
  const exitsCount = document.getElementById("exitsCount");
  const totalTime = document.getElementById("totalTime");
  const violationsCount = document.getElementById("violationsCount");

  try {
    const gateRef = collection(db, "gate_logs");
    const roundRef = collection(db, "roundabout");
    const parkedRef = collection(db, "parked");

    const [gateSnap, roundSnap, parkedSnap] = await Promise.all([
      getDocs(query(gateRef, where("plate_number", "==", plateNumber))),
      getDocs(query(roundRef, where("plate_number", "==", plateNumber))),
      getDocs(query(parkedRef, where("plate_number", "==", plateNumber)))
    ]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Helper to check if a timestamp is from today
    const isToday = (timestamp) => {
      let t;
      if (timestamp?.toDate) t = timestamp.toDate();
      else if (typeof timestamp === "string") t = new Date(timestamp.replace(" ", "T"));
      if (!t || isNaN(t)) return false;
      return t >= today && t < new Date(today.getTime() + 86400000);
    };

    // Extract today's data
    const gateLogs = gateSnap.docs.map(d => d.data()).filter(d => isToday(d.timestamp));
    const roundLogs = roundSnap.docs.map(d => d.data()).filter(d => isToday(d.timestamp));
    const parkedLogs = parkedSnap.docs.map(d => d.data()).filter(d => isToday(d.timestamp));

    // ---- COUNT ENTRIES & EXITS ----
    const entryCount = gateLogs.filter(g => g.event_type === "entry").length;
    const exitCount = gateLogs.filter(g => g.event_type === "exit").length;

    // ---- TOTAL DURATION ----
    let totalMinutes = 0;
    roundLogs.forEach(r => totalMinutes += r.duration_min || 0);
    parkedLogs.forEach(p => totalMinutes += p.duration_min || 0);

    let displayTime;
    if (totalMinutes >= 60) {
      const hours = (totalMinutes / 60).toFixed(1);
      displayTime = `${hours} hr${hours >= 2 ? "s" : ""}`;
    } else {
      displayTime = `${Math.round(totalMinutes)} min`;
    }

    // ---- VIOLATIONS ----
    const violationCount = parkedLogs.filter(p => p.status === "violation").length;

    // ---- UPDATE HTML ----
    entriesCount.textContent = entryCount || 0;
    exitsCount.textContent = exitCount || 0;
    totalTime.textContent = displayTime || "0 min";
    violationsCount.textContent = violationCount || 0;

  } catch (err) {
    console.error("Failed to load user stats:", err);
  }
});