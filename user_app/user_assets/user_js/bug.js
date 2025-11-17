import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// FAQ accordion
document.querySelectorAll(".faq-item").forEach(item => {
    item.addEventListener("click", () => {
        item.classList.toggle("active");
    });
});

// Submit bug report
window.sendReport = async function () {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        Swal.fire("Error", "User not logged in.", "error");
        return;
    }

    const result = await Swal.fire({
        title: "Submit a Bug Report",
        input: "textarea",
        inputPlaceholder: "Describe the bug you encountered...",
        inputAttributes: { "aria-label": "Bug description" },
        showCancelButton: true,
        confirmButtonText: "Send Bug Report",
    });

    if (!result.isConfirmed || !result.value.trim()) return;

    const message = result.value.trim();

    try {
        await addDoc(collection(db, "reports"), {
            userId: String(currentUser.idNumber || "Unknown"),
            name: currentUser.fullName || "Unknown User",
            plateNumber: currentUser.plateNumber || "Unknown Plate",
            program: currentUser.program || "Unknown Program",
            concernType: "Bug Report",   // <── fixed type
            message: message,
            reply: null,                 // <── ensures one-way message
            timestamp: serverTimestamp(),
        });

        Swal.fire("Submitted!", "Your bug report has been sent.", "success");

    } catch (error) {
        console.error("❌ Error submitting bug report:", error);
        Swal.fire("Error", "Failed to send your report.", "error");
    }
};
