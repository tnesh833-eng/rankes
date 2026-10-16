// ══════════════════════════════════════════════════════════════════════════
// ADMIN BUTTON VISIBILITY — strictly visible ONLY when admin is logged in
// ══════════════════════════════════════════════════════════════════════════
(function revealAdminBtnIfAdmin() {
    async function check() {
        const btn = document.getElementById('adminNavBtn');
        if (!btn) return;

        // Default state: permanently hidden for all standard users and guests
        btn.style.setProperty('display', 'none', 'important');

        const token = localStorage.getItem('rh_auth_token') || '';
        let userEmail = '';
        try {
            const u = JSON.parse(localStorage.getItem('rh_user') || localStorage.getItem('rh_auth_user') || 'null');
            userEmail = (u && u.email) ? u.email.toLowerCase().trim() : '';
        } catch (e) {}
        if (!userEmail) {
            userEmail = (localStorage.getItem('rh_registered_email') || '').toLowerCase().trim();
        }

        const ADMIN_EMAILS = ['tnesh8833@gmail.com', 'tnesh833@gmail.com'];
        const isEmailMatch = ADMIN_EMAILS.includes(userEmail);

        // Standard user or guest: strictly hidden
        if (!token || !isEmailMatch) {
            btn.style.setProperty('display', 'none', 'important');
            return;
        }

        // Verify with backend that the current session is an authenticated admin
        try {
            const API = (window.location.protocol === "file:" || ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "3000")) ? "http://127.0.0.1:3000/api" : "/api";
            const res = await fetch(API + "/auth/is-admin", {
                headers: { "Authorization": "Bearer " + token }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.is_admin) {
                    btn.style.removeProperty('display');
                    btn.style.display = 'flex';
                    return;
                }
            }
        } catch (e) {
            // Local offline fallback for admin email
            if (isEmailMatch && token) {
                btn.style.removeProperty('display');
                btn.style.display = 'flex';
                return;
            }
        }

        btn.style.setProperty('display', 'none', 'important');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', check);
    } else {
        check();
    }
    setTimeout(check, 1000);
    setTimeout(check, 2500);

    window.addEventListener('storage', check);
    window.refreshAdminButtonVisibility = check;
})();

// ══════════════════════════════════════════════════════════════════════════
// GITHUB RELEASES MODAL — shows only new releases, no repo/user data
// ══════════════════════════════════════════════════════════════════════════
window.openGithubUpdatesModal = function () {
    const modal = document.getElementById('githubUpdatesModal');
    if (modal) modal.style.display = 'flex';
    fetchGithubReleases();
};

window.closeGithubUpdatesModal = function () {
    const modal = document.getElementById('githubUpdatesModal');
    if (modal) modal.style.display = 'none';
};

// A curated list of top open-source projects to source releases from.
// We fetch from multiple repos and merge into one "What's New in Tech" feed.
const RELEASE_SOURCES = [
    { repo: 'microsoft/vscode',    label: 'VS Code' },
    { repo: 'nodejs/node',         label: 'Node.js' },
    { repo: 'facebook/react',      label: 'React' },
    { repo: 'vuejs/vue',           label: 'Vue.js' },
    { repo: 'vercel/next.js',      label: 'Next.js' },
    { repo: 'tailwindlabs/tailwindcss', label: 'Tailwind CSS' },
    { repo: 'vitejs/vite',         label: 'Vite' },
    { repo: 'expressjs/express',   label: 'Express.js' },
];

async function fetchGithubReleases() {
    const container = document.getElementById('githubUpdatesContainer');
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:12px; padding:24px; color:var(--text-secondary);">
            <div style="width:18px; height:18px; border:2px solid var(--brand-primary, #cfa354); border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            Fetching latest releases...
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;

    try {
        // Fetch latest release from each source concurrently
        const promises = RELEASE_SOURCES.map(async ({ repo, label }) => {
            try {
                const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
                if (!res.ok) return null;
                const data = await res.json();
                return { label, data };
            } catch {
                return null;
            }
        });

        const results = (await Promise.all(promises)).filter(Boolean);

        if (!results.length) {
            container.innerHTML = '<div style="text-align:center; padding:24px; color:#f59e0b;">Could not fetch release data. Please try again.</div>';
            return;
        }

        // Sort by published date, newest first
        results.sort((a, b) => new Date(b.data.published_at) - new Date(a.data.published_at));

        container.innerHTML = '';

        results.forEach(({ label, data }) => {
            const version = data.tag_name || 'Unknown';
            const title = data.name || version;
            const isPrerelease = data.prerelease;
            const date = data.published_at
                ? new Date(data.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';
            // Extract first 2 lines of release notes (strip markdown)
            const rawBody = (data.body || '').replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').trim();
            const summary = rawBody.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').substring(0, 160);

            const badgeColor = isPrerelease ? '#f59e0b' : '#10b981';
            const badgeText = isPrerelease ? 'Pre-release' : 'Latest Release';

            const card = document.createElement('div');
            card.style.cssText = `
                background: linear-gradient(135deg, rgba(207,163,84,0.08), rgba(232,198,130,0.04));
                border: 1px solid rgba(207,163,84,0.22);
                border-radius: 12px;
                padding: 14px 16px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                transition: border-color 0.2s;
            `;
            card.onmouseover = () => { card.style.borderColor = 'rgba(232,198,130,0.5)'; };
            card.onmouseout = () => { card.style.borderColor = 'rgba(207,163,84,0.22)'; };

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1rem; font-weight:800; color:#e8c682;">${label}</span>
                        <code style="font-size:0.78rem; background:rgba(207,163,84,0.15); color:#e8c682; padding:2px 8px; border-radius:6px; font-weight:700;">${version}</code>
                        <span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:6px; background:${badgeColor}22; color:${badgeColor};">${badgeText}</span>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted, #64748b);">📅 ${date}</span>
                </div>
                ${title !== version ? `<div style="font-size:0.88rem; font-weight:600; color:var(--text-primary, #e2e8f0);">${title}</div>` : ''}
                ${summary ? `<div style="font-size:0.82rem; color:var(--text-secondary, #94a3b8); line-height:1.5;">${summary}${rawBody.length > 160 ? '...' : ''}</div>` : ''}
            `;
            container.appendChild(card);
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="text-align:center; padding:24px; color:#ef4444;">❌ Failed to load releases. Please try again later.</div>';
    }
}

