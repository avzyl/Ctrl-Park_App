// ========================= IMPORT FIREBASE ========================= //
import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, getDocs, getDoc, doc, setDoc, addDoc, serverTimestamp } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ========================= LEAFLET SETUP ========================= //
const CENTER = [14.8692841, 120.8012936];
const PROXIMITY_METERS = 1;
const VACATE_DISTANCE = 5;
const AUTO_VACATE_DELAY = 5000;

// ========================= SLOT NAME CONVERTERS ========================= //
// Converts "Parking 1" → "slot_1"
function displayToDocId(displayName) {
  if (!displayName) return "";
  return displayName.toLowerCase().replace("parking ", "slot_");
}

// Converts "slot_1" → "Parking 1"
function docIdToDisplay(docId) {
  if (!docId) return "";
  return docId.replace("slot_", "Parking ");
}

const locations = {
  // ======== Main Nodes ======== //
  "Gate": [14.869690, 120.801010],
  "Node 1": [14.869722, 120.801090],
  "Node 2": [14.869500, 120.801334],
  "Node 3": [14.869472, 120.801363],
  "Node 4": [14.869443, 120.801404],
  "Node 5":[14.869431, 120.801417],
  "Node 6":[14.869414, 120.801431],
  "Node 7":[14.869396, 120.801443],
  "Node 8":[14.869383, 120.801458],
  "Node 9":[14.869364, 120.801473],
  "Node 10":[14.869346, 120.801486],
  "Node 11":[14.869331, 120.801500],
  "Node 12":[14.869317, 120.801517],
  "Node 13":[14.869297, 120.801535],
  "Node 14":[14.869283, 120.801549], 
  "Node 15":[14.869268, 120.801563],
  "Node 16":[14.869253, 120.801578],
  "Node 17":[14.869238, 120.801593],
  "Node 18":[14.869218, 120.801613],
  "Node 19":[14.869203, 120.801628],
  "Node 20":[14.869187, 120.801643],
  "Node 21":[14.869199, 120.801694],
  "Node 22":[14.869250, 120.801702],
  "Node 23":[14.869265, 120.801687],
  "Node 24":[14.869280, 120.801672],
  "Node 25":[14.869293, 120.801659],
  "Node 26":[14.869308, 120.801644],
  "Node 27":[14.869325, 120.801630],
  "Node 28":[14.869340, 120.801615],
  "Node 29":[14.869365, 120.801600],
  "Node 30":[14.869380, 120.801585],
  "Node 31":[14.869395, 120.801570],
  "Node 32":[14.869415, 120.801555],
  "Node 33":[14.869435, 120.801540],
  "Node 34":[14.869455, 120.801525],
  "Node 35":[14.869475, 120.801510],
  "Node 36":[14.869495, 120.801495],
  "Node 37":[14.869515, 120.801480],
  "Node 38":[14.869535, 120.801465],
  
  // ======== Parking Slots ======== //
  "Parking 1": [14.869197, 120.801579],
  "Parking 2": [14.869212, 120.801564],
  "Parking 3": [14.869227, 120.801549],
  "Parking 4": [14.869242, 120.801534],
  "Parking 5": [14.869257, 120.801519],
  "Parking 6": [14.869272, 120.801504],
  "Parking 7": [14.869287, 120.801489],
  "Parking 8": [14.869302, 120.801474],
  "Parking 9": [14.869317, 120.801459],
  "Parking 10": [14.869334, 120.801447],
  "Parking 11": [14.869349, 120.801431],
  "Parking 12": [14.869366, 120.801417],
  "Parking 13": [14.869383, 120.801401],
  "Parking 14": [14.869400, 120.801389],
  "Parking 15": [14.869416, 120.801373],
  "Parking 16": [14.869431, 120.801357],
  "Parking 17": [14.869445, 120.801343],
  "Parking 18": [14.869456, 120.801326],

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
    { from: "Node 1", to: "Node 17", instruction: "Go Straight" },
    { from: "Node 17", to: "Parking 2", instruction: "Arrive at Parking 2" }
  ],
  "Parking 3": [
    { from: "Gate", to: "Node 1", instruction: "Turn Right" },
    { from: "Node 1", to: "Node 16", instruction: "Go Straight" },
    { from: "Node 16", to: "Parking 3", instruction: "Arrive at Parking 3" }
  ],
  "Parking 4": [
    { from: "Gate", to: "Node 1", instruction: "Turn Right" },
    { from: "Node 1", to: "Node 15", instruction: "Go Straight" },
    { from: "Node 15", to: "Parking 4", instruction: "Arrive at Parking 4" }
  ],
  "Parking 5": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 14", "instruction": "Go Straight" },
    { "from": "Node 14", "to": "Parking 5", "instruction": "Arrive at Parking 5" }
  ],
  "Parking 6": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 13", "instruction": "Go Straight" },
    { "from": "Node 13", "to": "Parking 6", "instruction": "Arrive at Parking 6" }
  ],
  "Parking 7": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 12", "instruction": "Go Straight" },
    { "from": "Node 12", "to": "Parking 7", "instruction": "Arrive at Parking 7" }
  ],
  "Parking 8": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 11", "instruction": "Go Straight" },
    { "from": "Node 11", "to": "Parking 8", "instruction": "Arrive at Parking 8" }
  ],
  "Parking 9": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 10", "instruction": "Go Straight" },
    { "from": "Node 10", "to": "Parking 9", "instruction": "Arrive at Parking 9" }
  ],
  "Parking 10": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 9", "instruction": "Go Straight" },
    { "from": "Node 9", "to": "Parking 10", "instruction": "Arrive at Parking 10" }
  ],
  "Parking 11": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 8", "instruction": "Go Straight" },
    { "from": "Node 8", "to": "Parking 11", "instruction": "Arrive at Parking 11" }
  ],
  "Parking 12": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 7", "instruction": "Go Straight" },
    { "from": "Node 7", "to": "Parking 12", "instruction": "Arrive at Parking 12" }
  ],
  "Parking 13": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 6", "instruction": "Go Straight" },
    { "from": "Node 6", "to": "Parking 13", "instruction": "Arrive at Parking 13" }
  ],
  "Parking 14": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 5", "instruction": "Go Straight" },
    { "from": "Node 5", "to": "Parking 14", "instruction": "Arrive at Parking 14" }
  ],
  "Parking 15": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 4", "instruction": "Go Straight" },
    { "from": "Node 4", "to": "Parking 15", "instruction": "Arrive at Parking 15" }
  ],
  "Parking 16": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 3", "instruction": "Go Straight" },
    { "from": "Node 3", "to": "Parking 16", "instruction": "Arrive at Parking 16" }
  ],
  "Parking 17": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 3", "instruction": "Go Straight" },
    { "from": "Node 3", "to": "Parking 17", "instruction": "Arrive at Parking 17" }
  ],
  "Parking 18": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 2", "instruction": "Go Straight" },
    { "from": "Node 2", "to": "Parking 18", "instruction": "Arrive at Parking 18" }
  ],

  // second
  "Parking 19": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Parking 19", "instruction": "Arrive at Parking 19" }
  ],
  "Parking 20": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 19", "instruction": "Go Straight" },
    { "from": "Node 19", "to": "Parking 20", "instruction": "Arrive at Parking 20" }
  ],
  "Parking 21": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 18", "instruction": "Go Straight" },
    { "from": "Node 18", "to": "Parking 21", "instruction": "Arrive at Parking 21" }
  ],
  "Parking 22": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 17", "instruction": "Go Straight" },
    { "from": "Node 17", "to": "Parking 22", "instruction": "Arrive at Parking 22" }
  ],
  "Parking 23": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 16", "instruction": "Go Straight" },
    { "from": "Node 16", "to": "Parking 23", "instruction": "Arrive at Parking 23" }
  ],
  "Parking 24": [
  { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
  { "from": "Node 1", "to": "Node 15", "instruction": "Go Straight" },
  { "from": "Node 15", "to": "Parking 24", "instruction": "Arrive at Parking 24" }
  ],
  "Parking 25": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 14", "instruction": "Go Straight" },
    { "from": "Node 14", "to": "Parking 25", "instruction": "Arrive at Parking 25" }
  ],
  "Parking 26": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 13", "instruction": "Go Straight" },
    { "from": "Node 13", "to": "Parking 26", "instruction": "Arrive at Parking 26" }
  ],
  "Parking 27": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 12", "instruction": "Go Straight" },
    { "from": "Node 12", "to": "Parking 27", "instruction": "Arrive at Parking 27" }
  ],
  "Parking 28": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 11", "instruction": "Go Straight" },
    { "from": "Node 11", "to": "Parking 28", "instruction": "Arrive at Parking 28" }
  ],
  "Parking 29": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 10", "instruction": "Go Straight" },
    { "from": "Node 10", "to": "Parking 29", "instruction": "Arrive at Parking 29" }
  ],
  "Parking 30": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 9", "instruction": "Go Straight" },
    { "from": "Node 9", "to": "Parking 30", "instruction": "Arrive at Parking 30" }
  ],
  "Parking 31": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 8", "instruction": "Go Straight" },
    { "from": "Node 8", "to": "Parking 31", "instruction": "Arrive at Parking 31" }
  ],
  "Parking 32": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 7", "instruction": "Go Straight" },
    { "from": "Node 7", "to": "Parking 32", "instruction": "Arrive at Parking 32" }
  ],
  "Parking 33": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 6", "instruction": "Go Straight" },
    { "from": "Node 6", "to": "Parking 33", "instruction": "Arrive at Parking 33" }
  ],
  "Parking 34": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 5", "instruction": "Go Straight" },
    { "from": "Node 5", "to": "Parking 34", "instruction": "Arrive at Parking 34" }
  ],

  // third row
  "Parking 35": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Parking 35", "instruction": "Arrive at Parking 35" }
  ],
  "Parking 36": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Parking 36", "instruction": "Arrive at Parking 36" }
  ],
  "Parking 37": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 25", "instruction": "Go Straight" },
    { "from": "Node 25", "to": "Parking 37", "instruction": "Arrive at Parking 36" }
  ],
  "Parking 38": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 26", "instruction": "Go Straight" },
    { "from": "Node 26", "to": "Parking 38", "instruction": "Arrive at Parking 38" }
  ],
  "Parking 39": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 27", "instruction": "Go Straight" },
    { "from": "Node 27", "to": "Parking 39", "instruction": "Arrive at Parking 39" }
  ],
  "Parking 40": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 28", "instruction": "Go Straight" },
    { "from": "Node 28", "to": "Parking 40", "instruction": "Arrive at Parking 40" }
  ],
  "Parking 41": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 29", "instruction": "Go Straight" },
    { "from": "Node 29", "to": "Parking 41", "instruction": "Arrive at Parking 41" }
  ],
  "Parking 42": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 30", "instruction": "Go Straight" },
    { "from": "Node 30", "to": "Parking 42", "instruction": "Arrive at Parking 42" }
  ],
  "Parking 43": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 31", "instruction": "Go Straight" },
    { "from": "Node 31", "to": "Parking 43", "instruction": "Arrive at Parking 43" }
  ],
  "Parking 44": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 32", "instruction": "Go Straight" },
    { "from": "Node 32", "to": "Parking 44", "instruction": "Arrive at Parking 44" }
  ],
  "Parking 45": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 33", "instruction": "Go Straight" },
    { "from": "Node 33", "to": "Parking 45", "instruction": "Arrive at Parking 45" }
  ],
  "Parking 46": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 33", "instruction": "Go Straight" },
    { "from": "Node 33", "to": "Parking 46", "instruction": "Arrive at Parking 46" }
  ],
  "Parking 47": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 34", "instruction": "Go Straight" },
    { "from": "Node 34", "to": "Parking 47", "instruction": "Arrive at Parking 47" }
  ],
  "Parking 48": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 35", "instruction": "Go Straight" },
    { "from": "Node 35", "to": "Parking 48", "instruction": "Arrive at Parking 48" }
  ],
  "Parking 49": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 36", "instruction": "Go Straight" },
    { "from": "Node 36", "to": "Parking 49", "instruction": "Arrive at Parking 49" }
  ],
  "Parking 50": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 37", "instruction": "Go Straight" },
    { "from": "Node 37", "to": "Parking 50", "instruction": "Arrive at Parking 50" }
  ],
  "Parking 51": [
    { "from": "Gate", "to": "Node 1", "instruction": "Turn Right" },
    { "from": "Node 1", "to": "Node 20", "instruction": "Go Straight" },
    { "from": "Node 20", "to": "Node 21", "instruction": "Turn Left" },
    { "from": "Node 21", "to": "Node 22", "instruction": "Turn Left" },
    { "from": "Node 22", "to": "Node 23", "instruction": "Turn Left" },
    { "from": "Node 23", "to": "Node 38", "instruction": "Go Straight" },
    { "from": "Node 38", "to": "Parking 51", "instruction": "Arrive at Parking 51" }
  ],


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

// ========================= LOCAL STORAGE SESSION RESTORE ========================= //
function restoreSession() {
  const savedSlot = localStorage.getItem("parkedSlot");
  const savedHistId = localStorage.getItem("currentHistoryId");
  const savedCarLocation = localStorage.getItem("carLocation");

  if (savedSlot && savedHistId) {
    parkedSlot = savedSlot;
    currentHistoryId = savedHistId;
    console.log("🔄 Restored parked slot from localStorage:", parkedSlot);
  }

  if (savedCarLocation) {
    const loc = JSON.parse(savedCarLocation);
    carLocation = L.latLng(loc.lat, loc.lng);
    console.log("📍 Restored car location:", carLocation);

    carMarker = L.marker(carLocation, { icon: makeIcon("#0074D9", 18) })
      .addTo(map)
      .bindPopup("🚗 Your Location")
      .openPopup();
  }
}

// ========================= LOAD PARKING STATUS FROM FIREBASE ========================= //
async function fetchSlotStatus() {
  try {
    const querySnapshot = await getDocs(collection(db, "slots"));
    parkingStatus = {}; // reset before refill

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const slotDocId = docSnap.id; // e.g. "slot_1"
      const slotName = docIdToDisplay(slotDocId); // → "Parking 1"

      // ✅ Use CCTV_status first, then Map_status, then fallback
      const cctv = data.CCTV_status || null;
      const mapStat = data.Map_status || null;
      const legacy = data.status || null;

      let finalStatus = "Unknown";
      if (cctv) finalStatus = cctv;
      else if (mapStat) finalStatus = mapStat;
      else if (legacy) finalStatus = legacy;

      parkingStatus[slotName] = (finalStatus === "Available");

      console.log(
        `📡 Slot: ${slotName} | CCTV: ${cctv} | Map: ${mapStat} | Final: ${finalStatus}`
      );
    });

    for (const name in markers) {
      if (parkingStatus[name] !== undefined) {
        markers[name].setIcon(makeIcon(parkingStatus[name] ? "green" : "red"));
      }
    }
  } catch (err) {
    console.error("❌ Error fetching slot status:", err);
  }
}

// ========================= DRAW MARKERS ========================= //
async function initMarkers() {
  await fetchSlotStatus();

  Object.keys(locations).forEach((name) => {
    const coords = locations[name];

    if (name.startsWith("Node")) {
      return; 
    }

    let color = "blue";
    if (name.startsWith("Parking")) {
      color = parkingStatus[name] ? "green" : "red";
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

// ========================= GLOBALS FOR HISTORY ========================= //
let currentHistoryId = null; // track current slot_history document

window.confirmParking = async function confirmParking(name) {
  if (!carLocation) return alert("Click on the map to set your car location.");
  const dist = map.distance(carLocation, L.latLng(locations[name]));
  if (dist > PROXIMITY_METERS) return alert("Too far to park.");

  const currentUser = localStorage.getItem("currentUser") || "Guest";

  // Local UI update
  parkingStatus[name] = false;
  parkedSlot = name;
  markers[name].setIcon(makeIcon("red"));
  markers[name].bindPopup(`<b>${name}</b><br>Status: ❌ Occupied`).openPopup();
  clearRoute();

  try {
    // ✅ Step 1: Update slot_info document (overwrite or create if not existing)
    const slotInfoDocId = displayToDocId(name); // e.g., Parking 1 → slot_1
    const slotInfoRef = doc(db, "slot_info", slotInfoDocId);

    await setDoc(
      slotInfoRef,
      {
        slot_number: name,
        current_user: currentUser,
        accuracy: null,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`📝 slot_info updated for ${slotInfoDocId}`);

    // ✅ Step 2: Update slots collection (same as before)
    const slotDocId = displayToDocId(name);
    const slotRef = doc(db, "slots", slotDocId);

    await setDoc(
      slotRef,
      {
        Map_status: "Occupied",
        CCTV_status: "Occupied",
        accuracy: "High",
        status: "Occupied",
        system: "2D Map",
        current_user: currentUser,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✅ slots updated for ${slotDocId} (Occupied)`);

    // ✅ Step 3: Create a new slot_history entry
    const histRef = await addDoc(collection(db, "slot_history"), {
      slot_number: name,
      user: currentUser,
      parked_time: serverTimestamp(),
      vacate_time: null,
    });
    currentHistoryId = histRef.id;
    console.log(`🕓 History started for ${name}: ${currentHistoryId}`);

    // Optional: Refresh map
    await fetchSlotStatus();
  } catch (err) {
    console.error("❌ Error updating Firestore:", err);
  }

  // ✅ Save session locally
  localStorage.setItem("parkedSlot", name);
  localStorage.setItem("currentHistoryId", currentHistoryId);
  localStorage.setItem("parkedAt", new Date().toISOString());
  localStorage.setItem("carLocation", JSON.stringify({ lat: carLocation.lat, lng: carLocation.lng }));
  console.log("💾 Session saved locally:", { name, currentHistoryId });

};

// ========================= USER LOCATION LOGIC ========================= //
map.on("click", (e) => {
  carLocation = e.latlng;

  if (carMarker) map.removeLayer(carMarker);
  carMarker = L.marker(carLocation, { icon: makeIcon("#0074D9", 18) })
    .addTo(map)
    .bindPopup("🚗 Your Location")
    .openPopup();

  // Save car location persistently
  localStorage.setItem("carLocation", JSON.stringify({ lat: carLocation.lat, lng: carLocation.lng }));

  checkVacateSlot();

  // Auto-draw route to nearest available slot
  let nearest = null, nearestD = Infinity;
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
async function checkVacateSlot() {
  if (!parkedSlot || !carLocation) return;
  const slotPos = L.latLng(locations[parkedSlot]);
  const d = map.distance(carLocation, slotPos);

  if (d > VACATE_DISTANCE) {
    if (!autoVacateTimeout) {
      console.log(`🚗 Car moved ${Math.round(d)}m away from ${parkedSlot}. Auto-vacate in 5s if still away...`);

      autoVacateTimeout = setTimeout(async () => {
        try {
          console.log("⏳ Auto-vacate timer fired for", parkedSlot);

          const currentD = map.distance(carLocation, slotPos);
          console.log(`📏 Distance check after delay: ${currentD.toFixed(2)}m`);

          if (currentD > VACATE_DISTANCE) {
            const slotDocId = displayToDocId(parkedSlot);

            // ✅ Local UI update
            parkingStatus[parkedSlot] = true;
            markers[parkedSlot].setIcon(makeIcon("green"));
            markers[parkedSlot].bindPopup(`<b>${parkedSlot}</b><br>Status: ✅ Available`).openPopup();
            alert(`${parkedSlot} automatically vacated.`);

            // ---------------- Firestore Updates ----------------
            // 1️⃣ slots collection
            const slotRef = doc(db, "slots", slotDocId);
            await setDoc(
              slotRef,
              {
                Map_status: "Available",
                CCTV_status: "Available",
                accuracy: "High",
                status: "Available",
                current_user: "",
                timestamp: serverTimestamp(),
              },
              { merge: true }
            );
            console.log(`✅ slots updated for ${slotDocId} (Available)`);

            // ✅ Clear session from localStorage
            localStorage.removeItem("parkedSlot");
            localStorage.removeItem("currentHistoryId");
            localStorage.removeItem("parkedAt");
            console.log("🧹 Local session cleared after auto-vacate");

            // 2️⃣ slot_info collection
            const slotInfoRef = doc(db, "slot_info", slotDocId);
            await setDoc(
              slotInfoRef,
              {
                current_user: "",
                timestamp: serverTimestamp(),
              },
              { merge: true }
            );
            console.log(`📝 slot_info cleared current_user for ${slotDocId}`);

            // 3️⃣ slot_history collection
            if (currentHistoryId) {
              const histRef = doc(db, "slot_history", currentHistoryId);
              await setDoc(
                histRef,
                { vacate_time: serverTimestamp() },
                { merge: true }
              );
              console.log(`🕓 slot_history updated vacate_time for ${currentHistoryId}`);
              currentHistoryId = null; // reset
            }

            // Refresh map and suggest nearest
            await fetchSlotStatus();
            suggestNearestAfterParking();

            parkedSlot = null;
          } else {
            console.log("🚗 Car returned before timer elapsed — no auto-vacate.");
          }
        } catch (err) {
          console.error("❌ Auto-vacate error:", err);
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
  if (!carLocation) {
    console.warn("🚫 No car location available — skipping nearest slot suggestion.");
    return;
  }

  let nearest = null,
      nearestD = Infinity;
  for (const name in parkingStatus) {
    if (!parkingStatus[name]) continue;
    const d = map.distance(carLocation, L.latLng(locations[name]));
    if (d < nearestD) {
      nearestD = d;
      nearest = name;
    }
  }

  if (nearest) {
    console.log(`✨ Nearest available slot: ${nearest} (${nearestD.toFixed(1)}m away)`);
    drawRoute(nearest);
  }
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

// ========================= INIT ========================= //
document.addEventListener("DOMContentLoaded", async () => {
  restoreSession();
  await initMarkers();

  // Restore parked slot UI if session exists
  if (parkedSlot) {
    markers[parkedSlot].setIcon(makeIcon("red"));
    markers[parkedSlot].bindPopup(`<b>${parkedSlot}</b><br>Status: ❌ Occupied (Restored)`).openPopup();
    console.log(`✅ Session restored for ${parkedSlot}`);
  }
});
