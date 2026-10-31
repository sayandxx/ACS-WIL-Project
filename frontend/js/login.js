document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("loginForm");
    const message = document.getElementById("message");

    if (!form || !message) return;

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            message.textContent = "Please fill in all fields.";
            message.style.color = "red";
            return;
        }

        if (password.length < 8) {
            message.textContent = "Password must contain at least 8 characters.";
            message.style.color = "red";
            return;
        }

        // Backend Integration
        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.status === 200) {
                message.textContent = "Login successful! Welcome, " + data.user.full_name + ".";
                message.style.color = "green";
                form.reset();
            } else {
                message.textContent = data.message || "Invalid email or password.";
                message.style.color = "red";
            }
        } catch (error) {
            console.error("Error:", error);
            message.textContent = "Failed to connect to the server.";
            message.style.color = "red";
        }
    });
});