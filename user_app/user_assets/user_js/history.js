import { db } from "../../../../../main_assets/js/authentication/firebase.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// today's history
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

      const gateRef = collection(db, "gate_logs");
      const roundRef = collection(db, "roundabout");
      const parkRef = collection(db, "parked");

      const [gateSnap, roundSnap, parkSnap] = await Promise.all([
        getDocs(query(gateRef, where("plate_number", "==", plateNumber))),
        getDocs(query(roundRef, where("plate_number", "==", plateNumber))),
        getDocs(query(parkRef, where("plate_number", "==", plateNumber)))
      ]);

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const isToday = (ts) => {
        let d = ts?.toDate ? ts.toDate() : new Date(ts);
        return d >= startOfDay && d < endOfDay;
      };

      // --- STEP 1: Merge gate entry/exit ---
      const gateEntries = [];
      const gateExits = [];
      gateSnap.forEach(doc => {
        const d = doc.data();
        if (isToday(d.timestamp)) {
          if (d.event_type === "entry") gateEntries.push(d);
          else if (d.event_type === "exit") gateExits.push(d);
        }
      });

      const mergedGateEvents = [];
      gateEntries.forEach(entry => {
        const entryTime = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
        const matchingExit = gateExits.find(exit => {
          const exitTime = exit.timestamp?.toDate ? exit.timestamp.toDate() : new Date(exit.timestamp);
          const diffMin = (exitTime - entryTime) / 60000;
          return diffMin > 0 && diffMin <= 240; // within 4 hours
        });

        if (matchingExit) {
          const exitTime = matchingExit.timestamp?.toDate ? matchingExit.timestamp.toDate() : new Date(matchingExit.timestamp);
          mergedGateEvents.push({
            type: "gate",
            eventType: "Gate Event",
            entry_time: entryTime,
            exit_time: exitTime,
            duration_min: (exitTime - entryTime) / 60000,
            location: "Gate 3"
          });
        } else {
          mergedGateEvents.push({
            type: "gate",
            eventType: "Entry",
            entry_time: entryTime,
            exit_time: null,
            duration_min: null,
            location: "Gate 3"
          });
        }
      });

      // --- STEP 2: Include roundabout and parked events ---
      const allEvents = [...mergedGateEvents];

      roundSnap.forEach(doc => {
        const d = doc.data();
        if (isToday(d.timestamp)) {
          allEvents.push({
            type: "roundabout",
            eventType: "Roundabout",
            entry_time: d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time),
            exit_time: d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time),
            duration_min: d.duration_min,
            location: "Gate 3"
          });
        }
      });

      parkSnap.forEach(doc => {
        const d = doc.data();
        if (isToday(d.timestamp)) {
          allEvents.push({
            type: "parked",
            eventType: "Parked",
            entry_time: d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time),
            exit_time: d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time),
            duration_min: d.duration_min,
            slot: d.slot || "N/A",
            location: "Parking Area"
          });
        }
      });

      // --- STEP 3: Merge overlapping gate + roundabout/parked ---
      const mergedEvents = [];
      const used = new Set();

      for (let i = 0; i < allEvents.length; i++) {
        if (used.has(i)) continue;
        const a = allEvents[i];

        const matchIndex = allEvents.findIndex((b, j) => {
          if (i === j || used.has(j)) return false;
          const aStart = a.entry_time?.getTime() || 0;
          const bStart = b.entry_time?.getTime() || 0;
          const aEnd = a.exit_time?.getTime() || 0;
          const bEnd = b.exit_time?.getTime() || 0;
          const closeStart = Math.abs(aStart - bStart) < 2 * 60 * 1000; // 2 min
          const closeEnd = Math.abs(aEnd - bEnd) < 2 * 60 * 1000;
          const sameLoc = (a.location === b.location) || (a.type === "gate" && (b.type === "parked" || b.type === "roundabout"));
          return closeStart && closeEnd && sameLoc;
        });

        if (matchIndex >= 0) {
          const b = allEvents[matchIndex];

          // Determine merged event type
          let mergedType;
          if (b.type === "parked") mergedType = "Parked";
          else if (b.type === "roundabout") mergedType = "Roundabout";
          else mergedType = `${a.eventType} / ${b.eventType}`;

          // Determine location
          let mergedLocation;
          if (b.type === "parked") mergedLocation = "Parking Area";
          else mergedLocation = a.location; // default to gate location

          mergedEvents.push({
            ...a,
            eventType: mergedType,
            slot: b.slot || a.slot || null,
            duration_min: a.duration_min || b.duration_min,
            entry_time: a.entry_time,
            exit_time: a.exit_time || b.exit_time,
            location: mergedLocation
          });
        }
        used.add(i);
      }

      // --- STEP 4: Sort by latest exit/entry and take last 3 ---
      const latest = mergedEvents
        .sort((a, b) => {
          const aTime = a.exit_time || a.entry_time || new Date(0);
          const bTime = b.exit_time || b.entry_time || new Date(0);
          return bTime - aTime;
        })
        .slice(0, 3);

      recentContainer.innerHTML = "";

      if (latest.length === 0) {
        recentContainer.innerHTML = "<p>No activity recorded today.</p>";
        return;
      }

      latest.forEach(item => {
        const entry = item.entry_time ? item.entry_time.toLocaleTimeString("en-PH", { timeStyle: "short" }) : "—";
        const exit = item.exit_time ? item.exit_time.toLocaleTimeString("en-PH", { timeStyle: "short" }) : "—";
        const duration = item.duration_min
          ? (item.duration_min >= 60
            ? `${(item.duration_min / 60).toFixed(1)} hr`
            : `${Math.round(item.duration_min)} min`)
          : null;

        const card = document.createElement("div");
        card.className = "recent-card fade-in";
        card.innerHTML = `
          <div class="card-header">
            <h4>${item.eventType}</h4>
            <span class="timestamp">${item.exit_time ? exit : entry}</span>
          </div>
          <div class="card-body">
            <p><strong>Location:</strong> ${item.location}</p>
            ${item.slot ? `<p><strong>Slot:</strong> ${item.slot}</p>` : ""}
            ${item.entry_time && item.exit_time ? `
              <p><strong>Entry:</strong> ${entry}</p>
              <p><strong>Exit:</strong> ${exit}</p>
            ` : `<p><strong>Time:</strong> ${entry}</p>`}
            ${duration ? `<p><strong>Duration:</strong> ${duration}</p>` : ""}
          </div>
        `;
        recentContainer.appendChild(card);
      });

    } catch (err) {
      console.error("Failed to load recent events:", err);
      recentContainer.innerHTML = "<p style='color:red;'>Failed to load recent events.</p>";
    }
  }

  // --- Initial load + auto-refresh every 30s ---
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
          <p>Loading monthly activity...</p>
        </div>
      `;

      const gateRef = collection(db, "gate_logs");
      const roundRef = collection(db, "roundabout");
      const parkRef = collection(db, "parked");

      const [gateSnap, roundSnap, parkSnap] = await Promise.all([
        getDocs(query(gateRef, where("plate_number", "==", plateNumber))),
        getDocs(query(roundRef, where("plate_number", "==", plateNumber))),
        getDocs(query(parkRef, where("plate_number", "==", plateNumber)))
      ]);

      // --- STEP 1: Build raw events ---
      const gateEvents = [];
      gateSnap.forEach(doc => {
        const d = doc.data();
        const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp.replace(" ", "T"));
        gateEvents.push({
          type: "gate",
          eventType: d.event_type === "entry" ? "Entry" : "Exit",
          entry_time: ts,
          exit_time: null,
          duration_min: null,
          location: "Gate 3"
        });
      });

      const otherEvents = [];
      roundSnap.forEach(doc => {
        const d = doc.data();
        const entry_time = d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time);
        const exit_time = d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time);
        otherEvents.push({
          type: "roundabout",
          eventType: "Roundabout",
          entry_time,
          exit_time,
          duration_min: d.duration_min,
          location: "Gate 3"
        });
      });

      parkSnap.forEach(doc => {
        const d = doc.data();
        const entry_time = d.entry_time?.toDate ? d.entry_time.toDate() : new Date(d.entry_time);
        const exit_time = d.exit_time?.toDate ? d.exit_time.toDate() : new Date(d.exit_time);
        otherEvents.push({
          type: "parked",
          eventType: "Parked",
          entry_time,
          exit_time,
          duration_min: d.duration_min,
          slot: d.slot || "N/A",
          location: "Parking Area"
        });
      });

      // --- STEP 2: Merge sessions properly ---
      const mergeSessions = (gateEvents, otherEvents) => {
        const merged = [];
        const usedOther = new Set();

        const gates = [...gateEvents].sort((a, b) => a.entry_time - b.entry_time);
        const others = [...otherEvents].sort((a, b) => a.entry_time - b.entry_time);

        let i = 0;
        while (i < gates.length) {
          const gate = gates[i];

          if (gate.eventType === "Entry") {
            // Find next Exit
            const nextExit = gates.find((g, idx) => idx > i && g.eventType === "Exit");
            const sessionStart = gate.entry_time;
            const sessionEnd = nextExit?.entry_time || null;

            const session = {
              entry_time: sessionStart,
              exit_time: sessionEnd,
              events: ["Entry"],
              location: gate.location,
              slot: null,
              duration_min: null
            };

            // Merge roundabout/parked events in session window
            others.forEach((e, j) => {
              if (usedOther.has(j)) return;
              const eStart = e.entry_time.getTime();
              const sessionStartMs = sessionStart.getTime();
              const sessionEndMs = sessionEnd ? sessionEnd.getTime() : Infinity;

              if (eStart >= sessionStartMs && eStart <= sessionEndMs) {
                session.events.push(e.eventType);
                session.exit_time = e.exit_time || session.exit_time;
                session.duration_min = e.duration_min || session.duration_min;
                session.location = e.location || session.location;
                if (e.slot) session.slot = e.slot;
                usedOther.add(j);
              }
            });

            if (nextExit) session.events.push("Exit");

            merged.push(session);

            i = nextExit ? gates.indexOf(nextExit) + 1 : i + 1;
          } else {
            // Exit without Entry (orphaned), skip
            i++;
          }
        }

        // Add remaining unmatched otherEvents
        others.forEach((e, j) => {
          if (!usedOther.has(j)) merged.push(e);
        });

        // Sort descending
        return merged.sort((a, b) => b.entry_time - a.entry_time);
      };

      const allMerged = mergeSessions(gateEvents, otherEvents);

      // --- STEP 3: Group by day ---
      const grouped = {};
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const dateLabel = (d) => {
        const sameDay = (a, b) =>
          a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
        if (sameDay(d, today)) return "Today";
        if (sameDay(d, yesterday)) return "Yesterday";
        return d.toLocaleDateString("en-PH", { dateStyle: "medium" });
      };

      allMerged.forEach(item => {
        const label = dateLabel(item.entry_time);
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(item);
      });

      // --- STEP 4: Render ---
      monthlyContainer.innerHTML = "";
      if (allMerged.length === 0) {
        monthlyContainer.innerHTML = "<p>No activity recorded this month.</p>";
        return;
      }

      Object.entries(grouped).forEach(([label, entries]) => {
        const header = document.createElement("h4");
        header.textContent = label;
        header.style.marginTop = "20px";
        monthlyContainer.appendChild(header);

        entries.forEach(item => {
          const entryTimeStr = item.entry_time ? item.entry_time.toLocaleTimeString("en-PH", { timeStyle: "short" }) : "—";
          const exitTimeStr = item.exit_time ? item.exit_time.toLocaleTimeString("en-PH", { timeStyle: "short" }) : null;
          const durationStr = item.duration_min
            ? (item.duration_min >= 60 ? `${(item.duration_min / 60).toFixed(1)} hr` : `${Math.round(item.duration_min)} min`)
            : null;

          const div = document.createElement("div");
          div.className = "monthly-card fade-in";
          div.innerHTML = `
            <div class="card-header">
              <h4>${item.events.join(" → ")}</h4>
              <span class="timestamp">${exitTimeStr || entryTimeStr}</span>
            </div>
            <div class="card-body">
              <p><strong>Location:</strong> ${item.location}</p>
              ${item.slot ? `<p><strong>Slot:</strong> ${item.slot}</p>` : ""}
              ${item.entry_time && item.exit_time ? `
                <p><strong>Entry:</strong> ${entryTimeStr}</p>
                <p><strong>Exit:</strong> ${exitTimeStr}</p>
              ` : `<p><strong>Time:</strong> ${entryTimeStr}</p>`}
              ${durationStr ? `<p><strong>Duration:</strong> ${durationStr}</p>` : ""}
            </div>
          `;
          monthlyContainer.appendChild(div);
        });
      });

    } catch (err) {
      console.error("Failed to load monthly history:", err);
      monthlyContainer.innerHTML = "<p style='color:red;'>Failed to load monthly history.</p>";
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