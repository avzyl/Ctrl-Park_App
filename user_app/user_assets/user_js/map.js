// ========================= IMPORT FIREBASE =========================
import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, getDocs, getDoc, setDoc, addDoc, serverTimestamp } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ========================= LEAFLET SETUP =========================
const CENTER = [14.8692841, 120.8012936];
const PROXIMITY_METERS = 1;
const VACATE_DISTANCE = 5;
const AUTO_VACATE_DELAY = 5000;

const locations = {
  "Gate": [14.869690, 120.801010],
  "Node 1": [14.869722, 120.801090],
  "Node 2": [14.869500, 120.801334],
  "Node 3": [14.869252, 120.801567],
  "Node 4": [14.869167, 120.801648],
  "Node 5": [14.869206, 120.801705],
  "Node 6": [14.869225, 120.801708],
  "Node 7": [14.869309, 120.801519],
  "Node 8": [14.869472, 120.801363],
  "Parking 1": [14.869456, 120.801326],
  "Parking 2": [14.869445, 120.801343],
  "Parking 3": [14.869266, 120.801608],
  "Parking 4": [14.869280, 120.801485]
};

let parkingStatus = {}; // will be fetched from Firebase

const routes = {
  "Parking 1": [
    { from: "Gate", to: "Node 1", instruction: "Turn Right" },
    { from: "Node 1", to: "Node 2", instruction: "Go Straight" },
    { from: "Node 2", to: "Parking 1", instruction: "Arrive at Parking 1" }
  ],
  "Parking 2": [
    { from: "Gate", to: "Node 1", instruction: "Turn Right" },
    { from: "Node 1", to: "Node 8", instruction: "Go Straight" },
    { from: "Node 8", to: "Parking 2", instruction: "Arrive at Parking 2" }
  ],
  "Parking 3": [
    { from: "Gate", to: "Node 1", instruction: "Turn Right" },
    { from: "Node 1", to: "Node 2", instruction: "Go Straight" },
    { from: "Node 2", to: "Node 3", instruction: "Turn Left" },
    { from: "Node 3", to: "Parking 3", instruction: "Arrive at Parking 3" }
  ],
  "Parking 4": [
    { from: "Gate", to: "Node 1", instruction: "Turn Right" },
    { from: "Node 1", to: "Node 2", instruction: "Go Straight" },
    { from: "Node 2", to: "Node 7", instruction: "Turn Right" },
    { from: "Node 7", to: "Parking 4", instruction: "Arrive at Parking 4" }
  ]
};

// ========================= MAP INIT =========================
let map = L.map("map").setView(CENTER, 19);
let markers = {};
let activePolylines = [];
let carMarker = null;
let carLocation = null;
let parkedSlot = null;
let autoConfirmTimeout = null;
let autoVacateTimeout = null;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 22,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// ========================= ICON MAKER =========================
function makeIcon(color, size = 14) {
  return L.divIcon({
    className: "custom-icon",
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid black"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ========================= LOAD PARKING STATUS FROM FIREBASE =========================
async function fetchSlotStatus() {
  try {
    const querySnapshot = await getDocs(collection(db, "slots"));
    parkingStatus = {}; // reset before refill

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const slotNumber = data.slot_number;

      // 🔧 Convert "1" → "Parking 1"
      const slotName = `Parking ${slotNumber}`;

      parkingStatus[slotName] = (data.status === "Available");

      console.log(
        `Slot: ${slotName} | Firestore: ${data.status} | Parsed: ${
          parkingStatus[slotName] ? "Available ✅" : "Occupied ❌"
        }`
      );
    });
  } catch (err) {
    console.error("Error fetching slot status:", err);
  }
}


// ========================= DRAW MARKERS =========================
async function initMarkers() {
  await fetchSlotStatus();

  Object.keys(locations).forEach((name) => {
    const coords = locations[name];
    let color = "blue";

    if (name.startsWith("Parking")) {
      color = parkingStatus[name] ? "green" : "red";
    } else if (name.startsWith("Node")) {
      color = "orange";
    } else if (name === "Gate") {
      color = "#444";
    }

    const marker = L.marker(coords, { icon: makeIcon(color) }).addTo(map);

    if (name.startsWith("Parking")) {
      marker.on("click", () => handleParkingClick(name));
    } else {
      marker.bindPopup(name);
    }

    markers[name] = marker;
  });

  // Show initial nearest route
  showNearestFromGate();
}

// ========================= ROUTE + DIRECTIONS =========================
function clearRoute() {
  activePolylines.forEach((line) => map.removeLayer(line));
  activePolylines = [];
  document.getElementById("directions").style.display = "none";
}

function drawRoute(parkingName) {
  clearRoute();
  const steps = routes[parkingName];
  const dirBox = document.getElementById("directions");
  const dirContent = document.getElementById("directions-content");
  dirBox.style.display = "block";
  dirContent.innerHTML = `<b>Route to ${parkingName}:</b><br>`;

  steps.forEach((step) => {
    const from = locations[step.from];
    const to = locations[step.to];
    const line = L.polyline([from, to], { color: "blue", weight: 5 }).addTo(map);
    activePolylines.push(line);
    dirContent.innerHTML += `➡️ ${step.instruction}<br>`;
  });
}

document.getElementById("close-directions").onclick = () => {
  document.getElementById("directions").style.display = "none";
  document.getElementById("reopen-directions").style.display = "block";
};
document.getElementById("reopen-directions").onclick = () => {
  document.getElementById("directions").style.display = "block";
  document.getElementById("reopen-directions").style.display = "none";
};

// ========================= PARKING LOGIC =========================
function handleParkingClick(name) {
  if (!parkingStatus[name]) {
    markers[name].bindPopup(`<b>${name}</b><br>Status: ❌ Occupied`).openPopup();
    return;
  }

  if (!carLocation) {
    markers[name].bindPopup(`<b>${name}</b><br>Status: ✅ Available<br><i>Click map to set your car location</i>`).openPopup();
    return;
  }

  const dist = map.distance(carLocation, L.latLng(locations[name]));
  drawRoute(name);

  if (dist <= PROXIMITY_METERS) {
    markers[name]
      .bindPopup(`<b>${name}</b><br>Status: ✅ Available<br>
        <div>Distance: ${Math.round(dist)} m</div>
        <div><button onclick="confirmParking('${name}')">Park Here</button></div>`)
      .openPopup();

    clearTimeout(autoConfirmTimeout);
    autoConfirmTimeout = setTimeout(() => confirmParking(name), 5000);
  } else {
    markers[name].bindPopup(`<b>${name}</b><br>Too far (${Math.round(dist)} m). Move closer.`).openPopup();
  }
}

window.confirmParking = async function confirmParking(name) {
  if (!carLocation) return alert("Click on the map to set your car location.");
  const dist = map.distance(carLocation, L.latLng(locations[name]));
  if (dist > PROXIMITY_METERS) return alert("Too far to park.");

  parkingStatus[name] = false;
  parkedSlot = name;
  markers[name].setIcon(makeIcon("red"));
  markers[name].bindPopup(`<b>${name}</b><br>Status: ❌ Occupied`).openPopup();
  clearRoute();

  // ✅ Step 1: Push parking info to Firestore (slot_info)
  try {
    await addDoc(collection(db, "slot_info"), {
      location: "Gate 3",
      slot_number: name,
      current_user: localStorage.getItem("currentUser") || "Guest",
      accuracy: null,
      timestamp: serverTimestamp(),
    });
    console.log(`✅ Slot info for ${name} saved.`);
  } catch (err) {
    console.error("❌ Error saving slot info:", err);
  }

  // ✅ Step 2: Update Firestore slots collection with map + CCTV comparison
  try {
    const slotsRef = collection(db, "slots");
    const slotNumber = name.replace("Parking ", ""); // "Parking 1" → "1"
    const slotDoc = doc(slotsRef, slotNumber);

    // Fetch existing slot info (which includes cctv_status)
    const snap = await getDoc(slotDoc);
    let cctvStatus = "Unknown";

    if (snap.exists()) {
      const data = snap.data();
      if (data.cctv_status) cctvStatus = data.cctv_status;
    }

    const mapStatus = "Occupied";
    let accuracy = "Unknown";

    if (cctvStatus === "Unknown") accuracy = "Unknown";
    else if (cctvStatus === mapStatus) accuracy = "High";
    else accuracy = "Low";

    await setDoc(slotDoc, {
      slot_number: slotNumber,
      location: "Gate 3",
      Map_status: mapStatus,
      CCTV_status: cctvStatus,
      accuracy: accuracy,
      timestamp: serverTimestamp(),
    }, { merge: true });

    console.log(
      `📡 Updated Firestore: ${name} | map=${mapStatus}, cctv=${cctvStatus}, accuracy=${accuracy}`
    );

    // ✅ Step 3: Prioritize CCTV status for display on map
    if (cctvStatus !== "Unknown" && cctvStatus !== mapStatus) {
      const iconColor = cctvStatus === "Available" ? "green" : "red";
      markers[name].setIcon(makeIcon(iconColor));
      markers[name].bindPopup(`<b>${name}</b><br>Status (CCTV): ${cctvStatus}`).openPopup();
      console.log(`🎥 CCTV override: ${name} shown as ${cctvStatus}`);
    }

  } catch (err) {
    console.error("❌ Error updating slots collection:", err);
  }
};


// ========================= USER LOCATION LOGIC =========================
map.on("click", (e) => {
  if (carMarker) map.removeLayer(carMarker);
  carLocation = e.latlng;
  carMarker = L.marker(carLocation, { icon: makeIcon("#0074D9", 18) })
    .addTo(map)
    .bindPopup("🚗 Your Location")
    .openPopup();

  checkVacateSlot();

  let nearest = null,
    nearestD = Infinity;
  for (const p in parkingStatus) {
    if (!parkingStatus[p]) continue;
    const d = map.distance(carLocation, L.latLng(locations[p]));
    if (d < nearestD) {
      nearestD = d;
      nearest = p;
    }
  }
  if (nearest) drawRoute(nearest);
});

// ========================= AUTO-VACATE =========================
function checkVacateSlot() {
  if (!parkedSlot || !carLocation) return;
  const slotPos = L.latLng(locations[parkedSlot]);
  const d = map.distance(carLocation, slotPos);

  if (d > VACATE_DISTANCE) {
    if (!autoVacateTimeout) {
      console.log(`Car moved ${Math.round(d)}m away from ${parkedSlot}. Auto-vacate in 5s if still away...`);
      autoVacateTimeout = setTimeout(() => {
        const currentD = map.distance(carLocation, slotPos);
        if (currentD > VACATE_DISTANCE) {
          parkingStatus[parkedSlot] = true;
          markers[parkedSlot].setIcon(makeIcon("green"));
          parkedSlot = null;
          alert("Slot automatically vacated after 5 seconds.");
          suggestNearestAfterParking();
        }
        autoVacateTimeout = null;
      }, AUTO_VACATE_DELAY);
    }
  } else if (autoVacateTimeout) {
    clearTimeout(autoVacateTimeout);
    autoVacateTimeout = null;
    console.log("Auto-vacate canceled — car returned near slot.");
  }
}

function suggestNearestAfterParking() {
  if (!carLocation) return;
  let nearest = null,
    nearestD = Infinity;
  for (const p in parkingStatus) {
    if (!parkingStatus[p]) continue;
    const d = map.distance(carLocation, L.latLng(locations[p]));
    if (d < nearestD) {
      nearestD = d;
      nearest = p;
    }
  }
  if (nearest) drawRoute(nearest);
}

function showNearestFromGate() {
  const gate = L.latLng(locations["Gate"]);
  let nearest = null,
    nearestD = Infinity;
  for (const p in parkingStatus) {
    if (!parkingStatus[p]) continue;
    const d = map.distance(gate, L.latLng(locations[p]));
    if (d < nearestD) {
      nearestD = d;
      nearest = p;
    }
  }
  if (nearest) drawRoute(nearest);
}

// ========================= INIT =========================
document.addEventListener("DOMContentLoaded", initMarkers);
