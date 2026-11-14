// Shown for any address the router doesn't know, e.g. /nothing-here

export default async function notFoundView(el) {
  el.innerHTML = `
    <div class="page">
      <div class="empty-state" style="padding:80px 20px;">
        <span class="eyebrow">ERROR 404</span>
        <h1 style="font-family:'Manrope',sans-serif; font-size:40px; margin:10px 0;">Page not found</h1>
        <p>The page you're looking for doesn't exist or has moved.</p>
        <p style="margin-top:24px;"><a class="btn btn-green" href="/">Back to Home</a></p>
      </div>
    </div>`;
}
