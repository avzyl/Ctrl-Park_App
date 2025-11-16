// ========================= IMPORT FIREBASE =========================
import { db } from "../../../main_assets/js/authentication/firebase.js";
import {
    collection,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ========================= MAP SETUP =========================
const CENTER = [14.8692841, 120.8012936];

const locations = {
  // "Gate": [14.869690, 120.801010],
  // "Node 1": [14.869722, 120.801090],
  // "Node 2": [14.869500, 120.801334],
  // "Node 3": [14.869252, 120.801567],
  // "Node 4": [14.869167, 120.801648],
  // "Node 5": [14.869206, 120.801705],
  // "Node 6": [14.869225, 120.801708],
  // "Node 7": [14.869309, 120.801519],
  // "Node 8": [14.869472, 120.801363],

  "Parking 1": [14.869456, 120.801326],
  "Parking 2": [14.869445, 120.801343],
  "Parking 3": [14.869200, 120.801560],
  "Parking 4": [14.869219, 120.801540],
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
  "Parking 18": [14.869184, 120.801578],

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

// PARKING STATUS (Available / Occupied)
let parkingStatus = {};


// ========================= ICON MAKER =========================
function makeIcon(color, size = 14) {
    return L.divIcon({
        className: "custom-icon",
        html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid black"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}


// ========================= FETCH SLOT STATUS FROM FIRESTORE =========================
async function fetchSlotStatus() {
    const snap = await getDocs(collection(db, "slots"));
    snap.forEach((doc) => {
        const d = doc.data();
        const slotName = `Parking ${d.slot_number}`;
        parkingStatus[slotName] = d.status === "Available";
    });
}


// ========================= FETCH LATEST SLOT_INFO FOR POPUP =========================
async function fetchLatestSlotInfo(slotName) {
    try {
        const slotInfoRef = collection(db, "slot_info");
        const q = query(
            slotInfoRef,
            where("slot_number", "==", slotName),
            orderBy("timestamp", "desc"),
            limit(1)
        );

        const snap = await getDocs(q);
        if (snap.empty) return null;

        const data = snap.docs[0].data();

        let parsedUser = {};
        try {
            parsedUser = JSON.parse(data.current_user);
        } catch {}

        return {
            accuracy: data.accuracy || "Unknown",
            user: parsedUser,
            timestamp: data.timestamp?.toDate().toLocaleString() || "Unknown"
        };
    } catch (e) {
        console.error("Error fetching slot info:", e);
        return null;
    }
}



// ========================= INIT MAP + MARKERS =========================
async function initMarkers() {
    await fetchSlotStatus();

    const map = L.map("map").setView(CENTER, 19);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 22
    }).addTo(map);

    Object.keys(locations).forEach((name) => {
        const coords = locations[name];

        let color = "blue";
        if (name.startsWith("Parking")) {
            color = parkingStatus[name] ? "green" : "red";
        } else if (name.startsWith("Node")) {
            color = "orange";
        } else if (name === "Gate") {
            color = "black";
        }

        const marker = L.marker(coords, { icon: makeIcon(color) }).addTo(map);

        // ========== CLICK EVENT FOR PARKING SLOTS ==========
        if (name.startsWith("Parking")) {
            marker.on("click", async () => {
                const info = await fetchLatestSlotInfo(name);

                if (!info) {
                    marker.bindPopup(`
                        <b>${name}</b><br>
                        <i>No recent activity found.</i>
                    `).openPopup();
                    return;
                }

                const u = info.user;

                marker.bindPopup(`
                    <b>${name}</b><br><hr>
                    <b>Last Activity</b><br>
                    <b>User:</b> ${u["user-name"] || u.fullName || "Unknown"}<br>
                    <b>Plate:</b> ${u["plateNumber"] || u["user-plateNumber"] || "Unknown"}<br>
                    <b>Vehicle:</b> ${u["vehicle"] || u["user-vehicle"] || "Unknown"}<br>
                    <b>Department:</b> ${u.department || u["user-department"] || "Unknown"}<br>
                    <b>Time:</b> ${info.timestamp}
                `).openPopup();
            });

        } else {
            marker.bindPopup(name);
        }
    });
}


// Run after page loads
document.addEventListener("DOMContentLoaded", initMarkers);
