function openLightbox(src) {
        document.getElementById('lightboxImg').src = src;
        document.getElementById('lightbox').classList.add('open');
    }
    function closeLightbox() {
        document.getElementById('lightbox').classList.remove('open');
    }
    document.getElementById('lightbox').addEventListener('click', function(e) {
        if (e.target === this) closeLightbox();
    });

    function socialLink(href, icon, label, cls) {
        if (!href || href === 'Not found') return '';
        return `<a href="${href}" target="_blank" class="social-btn ${cls}">
            <i class="${icon}"></i> ${label}
        </a>`;
    }

    function renderStars(rating) {
        if (!rating) return '';
        const full = Math.floor(rating);
        const half = rating % 1 >= 0.5;
        let s = '<span class="rating-stars">';
        for (let i = 0; i < full; i++) s += '<i class="fas fa-star"></i>';
        if (half) s += '<i class="fas fa-star-half-alt"></i>';
        s += '</span>';
        return s;
    }

    function capFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    async function searchCollege() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        document.getElementById('loader').style.display = 'block';
        document.getElementById('results').style.display = 'none';
        document.getElementById('errorMsg').style.display = 'none';
        document.getElementById('searchBtn').disabled = true;

        try {
            const res = await fetch(`/api/college-info?collegeName=${encodeURIComponent(query)}`);
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Failed');

            // ── Hero ───────────────────────────────────────────────
            document.getElementById('resName').textContent = d.collegeName;
            document.getElementById('resDescription').textContent = d.contactInfoSnippet || '—';

            const avatar = document.getElementById('heroAvatar');
            if (d.profileImage) {
                avatar.outerHTML = `<img id="heroAvatar" class="college-avatar" src="${d.profileImage}" alt="${d.collegeName}" onerror="this.outerHTML='<div id=heroAvatar class=college-avatar-placeholder>🏛️</div>'">`;
            }

            // ── Facts chips ────────────────────────────────────────
            const factsEl = document.getElementById('resFacts');
            factsEl.innerHTML = '';
            const factLabels = { founded:'📅 Est.', type:'🏫 Type', affiliation:'🔗', students:'👥 Students', campus:'🌿 Campus' };
            Object.entries(d.facts || {}).slice(0, 6).forEach(([k, v]) => {
                const chip = document.createElement('span');
                chip.className = 'fact-chip';
                chip.textContent = `${factLabels[k] || capFirst(k)}: ${v}`;
                factsEl.appendChild(chip);
            });

            // ── Social Grid ────────────────────────────────────────
            const sl = d.socialLinks || {};
            document.getElementById('socialGrid').innerHTML = [
                socialLink(sl.instagram, 'fab fa-instagram', 'Instagram', 'ig'),
                socialLink(sl.facebook,  'fab fa-facebook',  'Facebook',  'fb'),
                socialLink(sl.twitter,   'fab fa-x-twitter', 'Twitter/X', 'tw'),
                socialLink(sl.youtube,   'fab fa-youtube',   'YouTube',   'yt'),
                socialLink(sl.linkedin,  'fab fa-linkedin',  'LinkedIn',  'li'),
            ].filter(Boolean).join('') || '<p class="text-muted text-sm">No social profiles found.</p>';

            // ── Quick Links ────────────────────────────────────────
            document.getElementById('quickLinks').innerHTML = [
                socialLink(d.officialLink,        'fas fa-globe',         'Official Website', 'web'),
                socialLink(d.location?.mapsLink,  'fas fa-map-marker-alt','View on Maps',     'maps'),
            ].filter(Boolean).join('') || '<p class="text-muted text-sm">No links found.</p>';

            // ── Location ───────────────────────────────────────────
            const loc = d.location || {};
            let locHtml = '';
            if (loc.address && loc.address !== 'Not found')
                locHtml += `<div class="row-item"><i class="fas fa-map-marker-alt"></i><span>${loc.address}</span></div>`;
            if (loc.phone && loc.phone !== 'Not found')
                locHtml += `<div class="row-item"><i class="fas fa-phone"></i><span>${loc.phone}</span></div>`;
            if (loc.rating)
                locHtml += `<div class="row-item"><i class="fas fa-star" style="color:#fbbf24"></i><span>${renderStars(loc.rating)} ${loc.rating}${loc.reviews ? ` (${loc.reviews.toLocaleString()} reviews)` : ''}</span></div>`;
            if (loc.mapsLink && loc.mapsLink !== 'Not found')
                locHtml += `<div class="row-item"><i class="fas fa-location-arrow"></i><a href="${loc.mapsLink}" target="_blank">Open in Google Maps</a></div>`;
            document.getElementById('locationInfo').innerHTML = locHtml || '<p class="text-muted text-sm">Location data not available.</p>';

            // ── Gallery ────────────────────────────────────────────
            const gallery = document.getElementById('galleryGrid');
            gallery.innerHTML = '';
            (d.images || []).forEach(img => {
                const div = document.createElement('div');
                div.className = 'gallery-item';
                div.onclick = () => openLightbox(img.original || img.thumbnail);
                div.innerHTML = `
                    <img src="${img.thumbnail}" alt="${img.title}" loading="lazy"
                         onerror="this.parentElement.style.display='none'">
                    <div class="overlay"><p>${img.title}</p></div>`;
                gallery.appendChild(div);
            });
            if (!d.images?.length) gallery.innerHTML = '<p class="text-muted text-sm">No images available.</p>';

            // ── Videos ────────────────────────────────────────────
            const videoGrid = document.getElementById('videoGrid');
            videoGrid.innerHTML = '';
            (d.videos || []).forEach(v => {
                const thumb = v.thumbnail || '';
                const a = document.createElement('a');
                a.href = v.link || '#'; a.target = '_blank';
                a.className = 'video-card';
                a.innerHTML = `
                    <div class="video-thumb">
                        ${thumb ? `<img src="${thumb}" alt="${v.title}" loading="lazy">` : ''}
                        <div class="play-btn"><i class="fas fa-play-circle"></i></div>
                        ${v.duration ? `<span class="video-duration">${v.duration}</span>` : ''}
                    </div>
                    <div class="video-info">
                        <div class="video-title">${v.title || 'Untitled'}</div>
                        <div class="video-meta">${[v.channel, v.published].filter(Boolean).join(' · ')}</div>
                    </div>`;
                videoGrid.appendChild(a);
            });
            if (!d.videos?.length) videoGrid.innerHTML = '<p class="text-muted text-sm">No videos found.</p>';

            // ── Placements ─────────────────────────────────────────
            const pl = document.getElementById('placementList');
            pl.innerHTML = '';
            (d.placements || []).forEach(p => {
                pl.innerHTML += `<div class="info-item">
                    <a href="${p.link}" target="_blank"><h4>${p.title || '—'}</h4></a>
                    <p>${p.snippet || '—'}</p>
                </div>`;
            });
            if (!d.placements?.length) pl.innerHTML = '<p class="text-muted text-sm">No placement data found.</p>';

            // ── Affiliations ───────────────────────────────────────
            const af = document.getElementById('affiliationList');
            af.innerHTML = '';
            (d.affiliations || []).forEach(a => {
                af.innerHTML += `<div class="info-item">
                    <a href="${a.link}" target="_blank"><h4>${a.title || '—'}</h4></a>
                    <p>${a.snippet || '—'}</p>
                </div>`;
            });
            if (!d.affiliations?.length) af.innerHTML = '<p class="text-muted text-sm">No affiliation data found.</p>';

            // Show results
            document.getElementById('loader').style.display = 'none';
            const resultsEl = document.getElementById('results');
            resultsEl.style.display = 'block';
            resultsEl.style.animation = 'none';
            void resultsEl.offsetHeight;
            resultsEl.style.animation = 'fadeUp 0.6s ease forwards';

        } catch (err) {
            document.getElementById('loader').style.display = 'none';
            const errEl = document.getElementById('errorMsg');
            errEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${err.message}`;
            errEl.style.display = 'block';
        } finally {
            document.getElementById('searchBtn').disabled = false;
        }
    }