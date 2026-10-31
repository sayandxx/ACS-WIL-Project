document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("registerForm");
  const message = document.getElementById("formMessage");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const terms = document.getElementById("terms").checked;

    // Extract account type and capitalize the first letter to match the backend ENUM
    const accountTypeInput = document.querySelector('input[name="accountType"]:checked').value;
    const accountType = accountTypeInput.charAt(0).toUpperCase() + accountTypeInput.slice(1);

    message.className = "form-message";

    function showError(text) {
      message.textContent = text;
      message.classList.add("error");
    }

    if (!name || !email || !password || !confirmPassword) {
      showError("Please complete all required fields.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      showError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    if (!terms) {
      showError("Please accept the terms to continue.");
      return;
    }

    // Backend Integration
    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: name,
          email: email,
          password: password,
          account_type: accountType
        })
      });

      const data = await response.json();

      if (response.status === 201) {
        message.textContent = "Account created successfully!";
        message.classList.add("success");
        message.classList.remove("error");
        form.reset();
      } else {
        showError(data.message || "Registration failed.");
      }
    } catch (error) {
      console.error("Error:", error);
      showError("Failed to connect to the server.");
    }
  });
});