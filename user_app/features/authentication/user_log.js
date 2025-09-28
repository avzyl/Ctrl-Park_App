// ✅ Run when page loads
document.addEventListener("DOMContentLoaded", () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  // If no user found → force login
  if (!currentUser) {
    window.location.href = "/index.html"; // redirect to login
    return;
  }

  // ✅ Display user name (header or dashboard)
  const headerEl = document.getElementById("userNameHeader");
  const profileEl = document.getElementById("userNameProfile");
  const nameEl = document.getElementById("user-name");

  if (headerEl) headerEl.textContent = currentUser.fullName || "Guest";
  if (profileEl) profileEl.textContent = currentUser.fullName || "Guest";
  if (nameEl) nameEl.textContent = currentUser.fullName || "Guest";

  // ✅ Display role (replaces "Basic Plan" or similar)
  const roleEl = document.getElementById("user-role") || document.getElementById("user-plan");
  if (roleEl) {
    roleEl.textContent = currentUser.role
      ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
      : "No Role";

    // OPTIONAL: Add class for styling like role-admin / role-driver
    if (currentUser.role) {
      roleEl.classList.add(`role-${currentUser.role.toLowerCase()}`);
    }
  }

  // ✅ Display user photo (or fallback)
  const userPhoto = document.getElementById("user-photo");
  if (userPhoto) {
    if (currentUser.photoURL && currentUser.photoURL.trim() !== "") {
      userPhoto.src = currentUser.photoURL;
    } else {
      userPhoto.src = "../../user_assets/user_img/default-avatar.svg"; // fallback avatar
    }
  }
});
