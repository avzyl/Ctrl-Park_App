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

// calendar
// Select the input
const calendarInput = document.getElementById("history-calendar");

// Get current date in yyyy-mm-dd format
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const formattedDate = `${year}-${month}-${day}`;

// Set input value to today
calendarInput.value = formattedDate;


// flatpckr
// Example: dates that have parking history
const parkingDates = ["2025-09-25", "2025-09-27", "2025-09-28"]; // yyyy-mm-dd format

flatpickr("#history-calendar", {
    dateFormat: "Y-m-d",
    defaultDate: new Date(), // today
    enable: [
        function(date) {
            // Allow all dates (optional: restrict only to parking history)
            return true;
        }
    ],
    onDayCreate: function(dObj, dStr, fp, dayElem) {
        const date = dayElem.dateObj;
        const formatted = date.toISOString().split("T")[0]; // yyyy-mm-dd

        // Add a dot for dates in parkingDates
        if (parkingDates.includes(formatted)) {
            const dot = document.createElement("span");
            dot.style.width = "6px";
            dot.style.height = "6px";
            dot.style.backgroundColor = "#006ED3";
            dot.style.borderRadius = "50%";
            dot.style.display = "inline-block";
            dot.style.marginLeft = "5px";
            dayElem.appendChild(dot);
        }
    }
});
