import { db } from "../../../main_assets/js/authentication/firebase.js";
import { collection, addDoc, serverTimestamp, getDocs, updateDoc, doc } 
    from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const remindersList = document.getElementById("remindersList");
const addReminderModal = document.getElementById("addReminderModal");
const addReminderForm = document.getElementById("addReminderForm");
const modalTitle = document.getElementById("modalTitle");
const addBtn = document.querySelector(".add-reminder");
const closeBtn = addReminderModal.querySelector(".close");

let reminders = [];
let editIndex = null;

// Fetch reminders from Firestore
async function fetchReminders() {
    reminders = [];
    const querySnapshot = await getDocs(collection(db, "reminders"));
    querySnapshot.forEach(docSnap => {
        reminders.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderReminders();
}

// Save a new reminder to Firestore
async function saveReminderToFirebase(reminder) {
    try {
        const docRef = await addDoc(collection(db, "reminders"), {
            title: reminder.title,
            date: reminder.date,
            time: reminder.time,
            done: false,
            timestamp: serverTimestamp()
        });
        reminder.id = docRef.id;
        reminders.push(reminder);
        renderReminders();
        Swal.fire("Added!", "Reminder has been added.", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Failed to add reminder.", "error");
    }
}

// Update a reminder in Firestore
async function updateReminderInFirebase(index) {
    try {
        const reminder = reminders[index];
        const reminderDoc = doc(db, "reminders", reminder.id);
        await updateDoc(reminderDoc, {
            title: reminder.title,
            date: reminder.date,
            time: reminder.time,
            done: reminder.done
        });
        renderReminders();
        Swal.fire("Updated!", "Reminder updated.", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Failed to update reminder.", "error");
    }
}

function renderReminders() {
    remindersList.innerHTML = "";
    reminders.forEach((reminder, index) => {
        if (reminder.hidden) return; // Skip hidden reminders

        const div = document.createElement("div");
        div.classList.add("notification");
        if(reminder.done) div.classList.add("done");

        div.innerHTML = `
            <div class="content">
                <div class="info">
                    <h3>${reminder.title}</h3>
                    <small>${reminder.date} ${reminder.time}</small>
                </div>
                <div class="actions">
                    <span class="material-icons-sharp mark-done" title="Mark as Done">check_circle</span>
                    <span class="material-icons-sharp edit" title="Edit">edit</span>
                    <span class="material-icons-sharp hide" title="Hide/Delete">delete</span>
                </div>
            </div>
        `;

        // Hide/Delete Reminder
        div.querySelector(".hide").addEventListener("click", async () => {
            const result = await Swal.fire({
                title: "Delete this reminder?",
                text: "It will no longer be visible.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Yes, delete it",
            });

            if(result.isConfirmed){
                // Update Firestore
                const reminderDoc = doc(db, "reminders", reminder.id);
                await updateDoc(reminderDoc, { hidden: true });

                // Update local array and re-render
                reminders[index].hidden = true;
                renderReminders();

                Swal.fire("Hidden!", "", "success");
            }
        });

        remindersList.appendChild(div);
    });
}


// Add Reminder
addReminderForm.addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("reminderTitle").value.trim();
    const date = document.getElementById("reminderDate").value;
    const time = document.getElementById("reminderTime").value;

    if(!title || !date || !time){
        Swal.fire("Incomplete", "Please fill all fields.", "warning");
        return;
    }

    saveReminderToFirebase({ title, date, time });
    addReminderModal.style.display = "none";
    addReminderForm.reset();
});

// Open Modal
addBtn.addEventListener("click", () => {
    modalTitle.textContent = "Add Reminder";
    addReminderForm.reset();
    addReminderModal.style.display = "block";
});

// Close Modal
closeBtn.addEventListener("click", () => addReminderModal.style.display = "none");

// Close if clicked outside modal
window.addEventListener("click", e => {
    if(e.target == addReminderModal) addReminderModal.style.display = "none";
});

// Initial fetch
fetchReminders();
