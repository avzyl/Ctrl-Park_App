async function loadMap() {
  try {
    const res = await fetch("https://stream.bsitport2026.com/map");
    const data = await res.json();
    const { nodes, edges } = data;

    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges (connections)
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    for (const [from, toList] of Object.entries(edges)) {
      const [x1, y1] = nodes[from];
      toList.forEach(to => {
        const [x2, y2] = nodes[to];
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
    }

    // Draw nodes
    for (const [name, [x, y]] of Object.entries(nodes)) {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = name === "gate" ? "#e74c3c" : "#3498db";
      ctx.fill();

      // Labels
      ctx.fillStyle = "#000";
      ctx.font = "12px Arial";
      ctx.fillText(name, x + 10, y + 4);
    }
  } catch (err) {
    console.error("Error loading map:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadMap);


// leaflet
const CENTER = [14.8692841, 120.8012936];
const PROXIMITY_METERS = 1;
const VACATE_DISTANCE = 5; // meters
const AUTO_VACATE_DELAY = 5000; // 5 seconds

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

const parkingStatus = {
  "Parking 1": true,
  "Parking 2": true,
  "Parking 3": true,
  "Parking 4": true
};

const routes = {
  "Parking 1": [
    {from: "Gate", to: "Node 1", instruction: "Turn Right"},
    {from: "Node 1", to: "Node 2", instruction: "Go Straight"},
    {from: "Node 2", to: "Parking 1", instruction: "Arrive at Parking 1"}
  ],
  "Parking 2": [
    {from: "Gate", to: "Node 1", instruction: "Turn Right"},
    {from: "Node 1", to: "Node 8", instruction: "Go Straight"},
    {from: "Node 8", to: "Parking 2", instruction: "Arrive at Parking 2"}
  ],
  "Parking 3": [
    {from: "Gate", to: "Node 1", instruction: "Turn Right"},
    {from: "Node 1", to: "Node 2", instruction: "Go Straight"},
    {from: "Node 2", to: "Node 3", instruction: "Turn Left"},
    {from: "Node 3", to: "Parking 3", instruction: "Arrive at Parking 3"}
  ],
  "Parking 4": [
    {from: "Gate", to: "Node 1", instruction: "Turn Right"},
    {from: "Node 1", to: "Node 2", instruction: "Go Straight"},
    {from: "Node 2", to: "Node 7", instruction: "Turn Right"},
    {from: "Node 7", to: "Parking 4", instruction: "Arrive at Parking 4"}
  ]
};

let map = L.map('map').setView(CENTER, 19);
let markers = {};
let activePolylines = [];
let carMarker = null;
let carLocation = null;
let parkedSlot = null;
let autoConfirmTimeout = null;
let autoVacateTimeout = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

function makeIcon(color, size=14) {
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid black"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

Object.keys(locations).forEach(name => {
  const coords = locations[name];
  let color = 'blue';
  if (name.startsWith('Parking')) color = parkingStatus[name] ? 'green' : 'red';
  else if (name.startsWith('Node')) color = 'orange';
  else if (name === 'Gate') color = '#444';

  const marker = L.marker(coords, {icon: makeIcon(color)}).addTo(map);
  if (name.startsWith('Parking')) {
    marker.on('click', () => handleParkingClick(name));
  } else marker.bindPopup(name);
  markers[name] = marker;
});

function clearRoute() {
  activePolylines.forEach(line => map.removeLayer(line));
  activePolylines = [];
  document.getElementById('directions').style.display = 'none';
}

function drawRoute(parkingName) {
  clearRoute();
  const steps = routes[parkingName];
  const dirBox = document.getElementById('directions');
  const dirContent = document.getElementById('directions-content');
  dirBox.style.display = 'block';
  dirContent.innerHTML = `<b>Route to ${parkingName}:</b><br>`;
  steps.forEach(step => {
    const from = locations[step.from];
    const to = locations[step.to];
    const line = L.polyline([from, to], {color:'blue',weight:5}).addTo(map);
    activePolylines.push(line);
    dirContent.innerHTML += `➡️ ${step.instruction}<br>`;
  });
}

document.getElementById('close-directions').onclick = () => {
  document.getElementById('directions').style.display = 'none';
  document.getElementById('reopen-directions').style.display = 'block';
};
document.getElementById('reopen-directions').onclick = () => {
  document.getElementById('directions').style.display = 'block';
  document.getElementById('reopen-directions').style.display = 'none';
};

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
    markers[name].bindPopup(`<b>${name}</b><br>Status: ✅ Available<br>
      <div>Distance: ${Math.round(dist)} m</div>
      <div><button onclick="confirmParking('${name}')">Park Here</button></div>`).openPopup();

    clearTimeout(autoConfirmTimeout);
    autoConfirmTimeout = setTimeout(() => confirmParking(name), 5000);
  } else {
    markers[name].bindPopup(`<b>${name}</b><br>Too far (${Math.round(dist)} m). Move closer.`).openPopup();
  }
}

function confirmParking(name) {
  if (!carLocation) return alert('Click on the map to set your car location.');
  const dist = map.distance(carLocation, L.latLng(locations[name]));
  if (dist > PROXIMITY_METERS) return alert('Too far to park.');

  parkingStatus[name] = false;
  parkedSlot = name;
  markers[name].setIcon(makeIcon('red'));
  markers[name].bindPopup(`<b>${name}</b><br>Status: ❌ Occupied`).openPopup();
  clearRoute();
}
window.confirmParking = confirmParking;

map.on('click', e => {
  if (carMarker) map.removeLayer(carMarker);
  carLocation = e.latlng;
  carMarker = L.marker(carLocation, {icon: makeIcon('#0074D9',18)}).addTo(map).bindPopup('🚗 Your Location').openPopup();

  checkVacateSlot();

  let nearest = null, nearestD = Infinity;
  for (const p in parkingStatus) {
    if (!parkingStatus[p]) continue;
    const d = map.distance(carLocation, L.latLng(locations[p]));
    if (d < nearestD) { nearestD = d; nearest = p; }
  }
  if (nearest) drawRoute(nearest);
});

// ✅ Auto-vacate logic (with 5-second delay)
function checkVacateSlot() {
  if (!parkedSlot || !carLocation) return;
  const slotPos = L.latLng(locations[parkedSlot]);
  const d = map.distance(carLocation, slotPos);

  if (d > VACATE_DISTANCE) {
    if (!autoVacateTimeout) {
      console.log(`Car moved ${Math.round(d)}m away from ${parkedSlot}. Auto-vacate in 5s if still away...`);
      autoVacateTimeout = setTimeout(() => {
        // Check again before vacating
        const currentD = map.distance(carLocation, slotPos);
        if (currentD > VACATE_DISTANCE) {
          parkingStatus[parkedSlot] = true;
          markers[parkedSlot].setIcon(makeIcon('green'));
          parkedSlot = null;
          alert('Slot automatically vacated after 5 seconds.');
          suggestNearestAfterParking();
        }
        autoVacateTimeout = null;
      }, AUTO_VACATE_DELAY);
    }
  } else if (autoVacateTimeout) {
    // Cancel if the car returns near the slot
    clearTimeout(autoVacateTimeout);
    autoVacateTimeout = null;
    console.log('Auto-vacate canceled — car returned near slot.');
  }
}

function suggestNearestAfterParking() {
  if (!carLocation) return;
  let nearest = null, nearestD = Infinity;
  for (const p in parkingStatus) {
    if (!parkingStatus[p]) continue;
    const d = map.distance(carLocation, L.latLng(locations[p]));
    if (d < nearestD) { nearestD = d; nearest = p; }
  }
  if (nearest) drawRoute(nearest);
}

(function showNearestFromGate(){
  const gate = L.latLng(locations['Gate']);
  let nearest = null, nearestD = Infinity;
  for (const p in parkingStatus) {
    if (!parkingStatus[p]) continue;
    const d = map.distance(gate, L.latLng(locations[p]));
    if (d < nearestD) { nearestD = d; nearest = p; }
  }
  if (nearest) drawRoute(nearest);
})();