// Terms of Service (/terms) and Privacy Policy (/privacy), linked from the registration form (FB-07).
// These are short prototype policies written for the WIL project. A real launch would need
// them checked properly before going live.

function policyPage(el, { eyebrow, title, updated, sections }) {
  el.innerHTML = `
    <div class="page policy-page">
      <div class="page-header">
        <div>
          <span class="eyebrow">${eyebrow}</span>
          <h1>${title}</h1>
          <p>Last updated ${updated}</p>
        </div>
      </div>
      ${sections.map(([heading, body]) => `
        <section class="policy-section">
          <h2>${heading}</h2>
          ${body}
        </section>`).join('')}
      <p class="policy-back"><a href="/register">Back to Create Account</a></p>
    </div>`;
}

export async function termsView(el) {
  policyPage(el, {
    eyebrow: 'THE RULES',
    title: 'Terms of Service',
    updated: '14 November 2026',
    sections: [
      ['1. About ACS', `<p>ACS is a social awareness platform where people support causes, organisations run
        campaigns, and local businesses share promotions. This version is a student prototype.</p>`],
      ['2. Your account', `<p>You must give a real name and an email address you own. Keep your password
        private. You are responsible for what is posted from your account.</p>`],
      ['3. What you can post', `<p>Campaigns and promotions must be honest, legal and respectful. Don't post
        anything misleading, hateful, or that uses someone else's work without permission.</p>`],
      ['4. Moderation', `<p>Every campaign and promotion is checked by an administrator before it appears
        publicly. Administrators can reject anything that breaks these terms.</p>`],
      ['5. Closing your account', `<p>You can ask us to close your account at any time. We may close accounts
        that repeatedly break these terms.</p>`],
      ['6. Changes', `<p>We may update these terms. The date at the top shows the latest version.</p>`],
    ],
  });
}

export async function privacyView(el) {
  policyPage(el, {
    eyebrow: 'YOUR INFORMATION',
    title: 'Privacy Policy',
    updated: '14 November 2026',
    sections: [
      ['What we collect', `<p>Your full name, email address, account type, and the campaigns or promotions you
        submit. Your password is stored only as a secure hash, never as plain text.</p>`],
      ['Why we collect it', `<p>To create and secure your account, show your submissions, and let
        administrators review them. We don't sell your information or use it for advertising.</p>`],
      ['Who can see it', `<p>Approved campaigns show the creator's name. Your email address is only visible to
        you and to administrators.</p>`],
      ['How we protect it', `<p>Passwords are hashed with bcrypt, logins use tokens that stop working when you
        log out, and only administrators can reach moderation tools.</p>`],
      ['Your rights', `<p>We handle personal information in line with the Australian Privacy Principles under the
        <em>Privacy Act 1988</em> (Cth). You can ask to see or correct your information, or ask us to delete
        your account, by contacting the ACS team.</p>`],
      ['Complaints', `<p>If you're unhappy with how we handled your information, contact us first. If it isn't
        sorted out, you can complain to the Office of the Australian Information Commissioner (OAIC).</p>`],
    ],
  });
}
