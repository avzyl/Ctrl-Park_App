import { db } from "../../../../../main_assets/js/authentication/firebase.js";
import { collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const currentUser = JSON.parse(localStorage.getItem("currentUser"));
const concernTypeSelect = document.getElementById("concernType");
const otherConcernBox = document.getElementById("otherConcernBox");
const reportForm = document.getElementById("reportForm");

// 🟢 Show/hide "Other Concern" input box
concernTypeSelect.addEventListener("change", () => {
  otherConcernBox.style.display = concernTypeSelect.value === "Others" ? "block" : "none";
});

// 🟢 Handle form submission
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    Swal.fire("Error", "User not logged in.", "error");
    return;
  }

  const concernType = concernTypeSelect.value === "Others"
    ? document.getElementById("otherConcern").value.trim() || "Unspecified"
    : concernTypeSelect.value;

  const message = document.getElementById("message").value.trim();

  if (!concernType || !message) {
    Swal.fire("Incomplete", "Please fill in all required fields.", "warning");
    return;
  }

  try {
    const userId = String(currentUser.idNumber || "Unknown");

    console.log("🟢 Submitting report for userId:", userId);

    await addDoc(collection(db, "reports"), {
      userId,
      name: currentUser.fullName || "Anonymous",
      plateNumber: currentUser.plateNumber || "Unknown",
      program: currentUser.program || "Unknown",
      concernType,
      message,
      timestamp: serverTimestamp(),
    });

    Swal.fire("Submitted!", "Your report has been sent successfully.", "success").then(() => {
      window.location.href = "./reports.html";
    });

  } catch (error) {
    console.error("❌ Error submitting report:", error);
    Swal.fire("Error", "There was a problem submitting your report.", "error");
  }
});
