/**
 * Shared auth helpers — loaded on every page.
 */

function getUser() {
  try { return JSON.parse(localStorage.getItem('hak_user')); }
  catch { return null; }
}

function requireAuth() {
  const user = getUser();
  if (!user) { window.location.href = '/login.html'; return null; }
  return user;
}

function logout() {
  localStorage.removeItem('hak_user');
  window.location.href = '/login.html';
}

function injectUserNav() {
  const user = getUser();
  if (!user) return;
  $('.navbar nav').append(`
    <div style="display:flex;align-items:center;gap:10px;margin-left:12px;padding-left:12px;border-left:1px solid rgba(255,255,255,.25)">
      <span style="font-size:.85rem;color:rgba(255,255,255,.9)">${esc(user.name)}</span>
      <button onclick="logout()" style="background:rgba(255,255,255,.15);border:none;color:#fff;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:.82rem">Sign Out</button>
    </div>
  `);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "x5a9kjj4e2");
</script>
