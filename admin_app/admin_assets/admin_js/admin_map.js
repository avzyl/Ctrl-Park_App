// ========================= IMPORT FIREBASE ========================= //
import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, getDocs, getDoc, setDoc, addDoc, serverTimestamp } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ========================= LEAFLET SETUP ========================= //
const CENTER = [14.8692841, 120.8012936];
const PROXIMITY_METERS = 1;
const VACATE_DISTANCE = 5;
const AUTO_VACATE_DELAY = 5000;

const locations = {
  // ======== Main Nodes ======== //
  "Gate": [14.869690, 120.801010],
  "Node 1": [14.869722, 120.801090],
  "Node 2": [14.869500, 120.801334],
  "Node 3": [14.869252, 120.801567],
  "Node 4": [14.869167, 120.801648],
  "Node 5": [14.869206, 120.801705],
  "Node 6": [14.869225, 120.801708],
  "Node 7": [14.869309, 120.801519],
  "Node 8": [14.869472, 120.801363],

  // ======== Parking Slots ======== //
  "Parking 1": [14.869456, 120.801326],
  "Parking 2": [14.869445, 120.801343],
  "Parking 3": [14.869266, 120.801608],
  "Parking 4": [14.869280, 120.801485],
  "Parking 5": [14.869242, 120.801534],
  "Parking 6": [14.869257, 120.801519],
  "Parking 7": [14.869272, 120.801504],
  "Parking 8": [14.869287, 120.801489],
  "Parking 9": [14.869302, 120.801474],
  "Parking 10": [14.869317, 120.801459],
  "Parking 11": [14.869334, 120.801447],
  "Parking 12": [14.869349, 120.801431],
  "Parking 13": [14.869366, 120.801417],
  "Parking 14": [14.869383, 120.801401],
  "Parking 15": [14.869400, 120.801389],
  "Parking 16": [14.869416, 120.801373],
  "Parking 17": [14.869431, 120.801357],
  "Parking 18": [14.869448, 120.801343],

  // ======== Row 2 ======== //
  "Parking 19": [14.869205, 120.801672],
  "Parking 20": [14.869221, 120.801660],
  "Parking 21": [14.869235, 120.801646],
  "Parking 22": [14.869254, 120.801632],
  "Parking 23": [14.869272, 120.801613],
  "Parking 24": [14.869286, 120.801596],
  "Parking 25": [14.869303, 120.801582],
  "Parking 26": [14.869320, 120.801567],
  "Parking 27": [14.869336, 120.801553],
  "Parking 28": [14.869353, 120.801539],
  "Parking 29": [14.869366, 120.801524],
  "Parking 30": [14.869383, 120.801509],
  "Parking 31": [14.869401, 120.801493],
  "Parking 32": [14.869418, 120.801479],
  "Parking 33": [14.869435, 120.801467],
  "Parking 34": [14.869453, 120.801452],

  // ======== Row 3 ======== //
  "Parking 35": [14.869304, 120.801745],
  "Parking 36": [14.869321, 120.801729],
  "Parking 37": [14.869335, 120.801713],
  "Parking 38": [14.869350, 120.801697],
  "Parking 39": [14.869364, 120.801680],
  "Parking 40": [14.869379, 120.801664],
  "Parking 41": [14.869395, 120.801649],
  "Parking 42": [14.869410, 120.801634],
  "Parking 43": [14.869425, 120.801619],
  "Parking 44": [14.869440, 120.801603],
  "Parking 45": [14.869454, 120.801588],
  "Parking 46": [14.869469, 120.801573],
  "Parking 47": [14.869484, 120.801568],
  "Parking 48": [14.869499, 120.801552],
  "Parking 49": [14.869514, 120.801537],
  "Parking 50": [14.869529, 120.801522],
  "Parking 51": [14.869544, 120.801507]
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

// ========================= MAP INIT ========================= //
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

// ========================= ICON MAKER ========================= //
function makeIcon(color, size = 14) {
  return L.divIcon({
    className: "custom-icon",
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid black"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ========================= LOAD PARKING STATUS FROM FIREBASE ========================= //
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

// ========================= DRAW MARKERS ========================= //
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

// ========================= ROUTE + DIRECTIONS ========================= //
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

// ========================= PARKING LOGIC ========================= //
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


// ========================= USER LOCATION LOGIC ========================= //
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

// ========================= AUTO-VACATE ========================= //
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

// init
document.addEventListener("DOMContentLoaded", initMarkers);
