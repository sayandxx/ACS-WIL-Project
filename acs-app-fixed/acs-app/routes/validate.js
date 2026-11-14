// Small helpers shared by the routes, so every form is checked the same way.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(value) {
    return EMAIL_PATTERN.test(value) && value.length <= 255;
}

function isValidUrl(value) {
    if (value.length > 255) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

// Turns "12" into 12, and anything that isn't a positive whole number into null
function toId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// The categories listed in the design document. The server only accepts these (FB-06).
// Keep these in step with CAMPAIGN_CATEGORIES / BUSINESS_CATEGORIES in frontend/js/api.js.
const CAMPAIGN_CATEGORIES = ['Environment', 'Education', 'Community', 'Health', 'Animal Welfare', 'Other'];
const BUSINESS_CATEGORIES = ['Food and drink', 'Retail', 'Services', 'Health and wellbeing', 'Arts and crafts', 'Other'];

// Very common passwords that pass the length rule but are guessed first (FB-02)
const COMMON_PASSWORDS = new Set([
    'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssword', 'p@ssw0rd',
    '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
    'qwerty12', 'qwerty123', 'qwertyuiop', '1q2w3e4r', 'abc12345', 'abcd1234',
    'iloveyou', 'iloveyou1', 'letmein1', 'welcome1', 'welcome123', 'sunshine1',
    'football1', 'baseball1', 'admin123', 'administrator', 'changeme', 'trustno1',
]);

// Returns a message explaining what's wrong with the password, or null if it's fine.
// Rules: at least 8 characters, at most 72 (bcrypt ignores anything longer),
// at least one letter and at least one number or symbol, and not a well-known password.
function passwordProblem(password) {
    if (password.length < 8) return 'Password must contain at least 8 characters.';
    if (password.length > 72) return 'Password must be 72 characters or fewer.';
    if (!/[A-Za-z]/.test(password) || !/[^A-Za-z]/.test(password)) {
        return 'Password must include at least one letter and at least one number or symbol.';
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        return 'That password is too common. Please choose a different one.';
    }
    return null;
}

module.exports = {
    cleanText, isValidEmail, isValidUrl, toId, passwordProblem,
    CAMPAIGN_CATEGORIES, BUSINESS_CATEGORIES,
};
