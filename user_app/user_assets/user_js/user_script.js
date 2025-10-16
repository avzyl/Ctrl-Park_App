const menuOpen = document.getElementById('menu-open');
const menuClose = document.getElementById('menu-close');
const sideBar = document.querySelector('.container .left-section');
const sidebarItems = document.querySelectorAll('.container .left-section .sidebar .item');

menuOpen.addEventListener('click', () => {
    sideBar.style.top = '0';
});

menuClose.addEventListener('click', () => {
    sideBar.style.top = '-60vh';
});

let activeItem = sidebarItems[0];

sidebarItems.forEach(element => {
    element.addEventListener('click', () => {
        if (activeItem) {
            activeItem.removeAttribute('id');
        }

        element.setAttribute('id', 'active');
        activeItem = element;

    });
});

// ========================= CALENDAR ======================= //
document.addEventListener("DOMContentLoaded", async () => {
  const calendarInput = document.getElementById("history-calendar");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!calendarInput || !currentUser?.plateNumber) return;

  const plateNumber = currentUser.plateNumber;

  // Philippine "today"
  const now = new Date();
  const phToday = new Date(now.getTime() + (8 - now.getTimezoneOffset()/60) * 60*60*1000);
  const formattedToday = phToday.toISOString().split("T")[0];
  calendarInput.value = formattedToday;

  try {
    // Fetch logs
    const gateSnap = await getDocs(query(collection(db, "gate_logs"), where("plate_number","==",plateNumber)));
    const roundSnap = await getDocs(query(collection(db, "roundabout"), where("plate_number","==",plateNumber)));
    const parkSnap = await getDocs(query(collection(db, "parked"), where("plate_number","==",plateNumber)));

    // Collect unique activity dates
    const allDatesSet = new Set();
    const addDate = (ts) => {
      if (!ts) return;
      let d = ts?.toDate ? ts.toDate() : new Date(ts);
      // Adjust once to PH timezone
      const phDate = new Date(d.getTime() + (8 - d.getTimezoneOffset()/60) * 60*60*1000);
      allDatesSet.add(phDate.toISOString().split("T")[0]);
    };

    gateSnap.forEach(doc => addDate(doc.data().timestamp));
    roundSnap.forEach(doc => {
      const d = doc.data();
      addDate(d.entry_time);
      addDate(d.exit_time);
    });
    parkSnap.forEach(doc => {
      const d = doc.data();
      addDate(d.entry_time);
      addDate(d.exit_time);
    });

    const activityDates = Array.from(allDatesSet);

    // Initialize Flatpickr
    flatpickr("#history-calendar", {
      dateFormat: "Y-m-d",
      defaultDate: phToday,
      onDayCreate: function(dObj, dStr, fp, dayElem) {
        const dateStr = dayElem.dateObj.toISOString().split("T")[0];

        if (activityDates.includes(dateStr)) {
          const dot = document.createElement("span");
          dot.style.width = "6px";
          dot.style.height = "6px";
          dot.style.backgroundColor = "#006ED3";
          dot.style.borderRadius = "50%";
          dot.style.display = "inline-block";
          dot.style.marginLeft = "5px";
          dot.style.verticalAlign = "middle";
          dayElem.appendChild(dot);
        }

        // Highlight today
        if (dateStr === formattedToday) {
          dayElem.style.backgroundColor = "#e0f0ff";
          dayElem.style.borderRadius = "50%";
          dayElem.style.fontWeight = "bold";
        }
      }
    });

  } catch(err) {
    console.error("Failed to fetch activity dates:", err);
  }
});


// notif modal
document.addEventListener("DOMContentLoaded", () => {
  const notifBtn = document.getElementById("notifBtn");
  const notifModal = document.getElementById("notifModal");
  if (!notifBtn || !notifModal) return;

  const closeBtn = notifModal.querySelector(".close");

  // Open modal
  notifBtn.addEventListener("click", () => {
    notifModal.style.display = "block";
  });

  // Close modal on X click
  closeBtn.addEventListener("click", () => {
    notifModal.style.display = "none";
  });

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === notifModal) {
      notifModal.style.display = "none";
    }
  });
});
