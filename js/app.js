(() => {
    const APK_URL = "https://lzplayhd.online/LzPlay.apk";
    const VERSION_URL = "https://lzplayhd.online/latest-version.txt";
    const SHARE_URL = "https://lzplayhd.online";
    const SHARE_TITLE = "LzPlay";
    const SHARE_TEXT =
        "¡Mira LzPlay! Películas y series, ahora en nueva versión.\nDescárgala gratis aquí:";
    const SHARE_IMAGE = "assets/share-cover.png";
    const SHARE_IMAGE_NAME = "lzplay.png";
    const TMDB_KEY = "38e497c6c1a043d1341416e80915669f";
    const TMDB_IMG = "https://image.tmdb.org/t/p";
    const FALLBACK_BACKDROP =
        "https://image.tmdb.org/t/p/original/uIpJPDNFoeQ0AGVAg0Yd0s1bYlI.jpg";

    const GENRE_MAP = {
        28: "Acción",
        12: "Aventura",
        16: "Animación",
        35: "Comedia",
        80: "Crimen",
        99: "Documental",
        18: "Drama",
        10751: "Familiar",
        14: "Fantasía",
        36: "Historia",
        27: "Terror",
        10402: "Música",
        9648: "Misterio",
        10749: "Romance",
        878: "Ciencia ficción",
        10770: "TV",
        53: "Suspenso",
        10752: "Bélica",
        37: "Western",
    };

    const els = {
        bg: document.getElementById("bg"),
        bg2: document.getElementById("bg2"),
        track: document.getElementById("trending-track"),
        backdrop: document.getElementById("title-modal"),
        modalHero: document.getElementById("modal-hero"),
        modalLogo: document.getElementById("modal-logo"),
        modalLogoFallback: document.getElementById("modal-logo-fallback"),
        modalYear: document.getElementById("modal-year"),
        modalRating: document.getElementById("modal-rating"),
        modalType: document.getElementById("modal-type"),
        modalGenre: document.getElementById("modal-genre"),
        modalSynopsis: document.getElementById("modal-synopsis"),
        modalCta: document.getElementById("modal-cta"),
        modalShare: document.getElementById("modal-share"),
        modalClose: document.getElementById("modal-close"),
        downloadBackdrop: document.getElementById("download-modal"),
        downloadClose: document.getElementById("download-modal-close"),
        downloadVersion: document.getElementById("download-version"),
        downloadApkLink: document.getElementById("download-apk-link"),
        lightbox: document.getElementById("lightbox"),
        lightboxImg: document.getElementById("lightbox-img"),
        lightboxClose: document.getElementById("lightbox-close"),
        toast: document.getElementById("toast"),
    };

    let moviesCache = [];
    let currentMovie = null;
    let lastFocus = null;
    let toastTimer = null;
    let cachedVersion = null;
    let versionPromise = null;
    let shareImageFile = null;

    function showToast(message) {
        if (!els.toast) return;
        els.toast.textContent = message;
        els.toast.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            els.toast.classList.remove("is-visible");
        }, 2200);
    }

    function buildShareMessage(opts = {}) {
        const title = opts.title || SHARE_TITLE;
        const text = opts.text || SHARE_TEXT;
        const url = opts.url || SHARE_URL;
        return {
            title,
            text,
            url,
            fullText: `${text}\n${url}`,
        };
    }

    async function getShareImageFile() {
        if (shareImageFile) return shareImageFile;
        try {
            const res = await fetch(SHARE_IMAGE, { cache: "force-cache" });
            if (!res.ok) return null;
            const blob = await res.blob();
            const type = blob.type || "image/png";
            shareImageFile = new File([blob], SHARE_IMAGE_NAME, { type });
            return shareImageFile;
        } catch {
            return null;
        }
    }

    async function copyShareFallback(message) {
        try {
            await navigator.clipboard.writeText(message);
            showToast("Mensaje e enlace copiados");
            return true;
        } catch {
            /* fall through */
        }

        try {
            const area = document.createElement("textarea");
            area.value = message;
            area.setAttribute("readonly", "");
            area.style.position = "fixed";
            area.style.left = "-9999px";
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            document.body.removeChild(area);
            showToast("Mensaje e enlace copiados");
            return true;
        } catch {
            showToast("No se pudo compartir");
            return false;
        }
    }

    async function shareContent(opts = {}) {
        const msg = buildShareMessage(opts);
        const file = await getShareImageFile();

        if (navigator.share) {
            const withFile = file
                ? {
                      title: msg.title,
                      text: msg.fullText,
                      files: [file],
                  }
                : null;

            if (
                withFile &&
                navigator.canShare &&
                navigator.canShare({ files: withFile.files })
            ) {
                try {
                    await navigator.share(withFile);
                    return;
                } catch (err) {
                    if (err && err.name === "AbortError") return;
                }
            }

            try {
                await navigator.share({
                    title: msg.title,
                    text: msg.fullText,
                    url: msg.url,
                });
                return;
            } catch (err) {
                if (err && err.name === "AbortError") return;
            }
        }

        await copyShareFallback(`${msg.title}\n${msg.fullText}`);
    }

    function yearFromDate(dateStr) {
        if (!dateStr) return "—";
        return dateStr.slice(0, 4);
    }

    function primaryGenre(genreIds) {
        if (!genreIds || !genreIds.length) return "Películas";
        return GENRE_MAP[genreIds[0]] || "Películas";
    }

    function ratingLabel(movie) {
        if (movie.adult) return "18+";
        const vote = movie.vote_average || 0;
        if (vote >= 7) return "13+";
        if (vote >= 5) return "16+";
        return "13+";
    }

    function backdropUrl(path, size = "original") {
        return path ? `${TMDB_IMG}/${size}${path}` : FALLBACK_BACKDROP;
    }

    function posterUrl(path, size = "w500") {
        return path ? `${TMDB_IMG}/${size}${path}` : "";
    }

    async function fetchAppVersion() {
        if (cachedVersion) return cachedVersion;
        if (versionPromise) return versionPromise;

        versionPromise = (async () => {
            try {
                const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
                    cache: "no-store",
                });
                if (!res.ok) throw new Error("version fetch failed");
                const text = (await res.text()).trim();
                cachedVersion = text || null;
                return cachedVersion;
            } catch {
                return null;
            } finally {
                versionPromise = null;
            }
        })();

        return versionPromise;
    }

    function setDownloadVersionLabel(version) {
        if (!els.downloadVersion) return;
        if (version) {
            els.downloadVersion.textContent = version.startsWith("v")
                ? version
                : `v${version}`;
            els.downloadVersion.classList.remove("is-loading");
        } else {
            els.downloadVersion.textContent = "No disponible";
            els.downloadVersion.classList.add("is-loading");
        }
    }

    function anyModalOpen() {
        return (
            (els.backdrop && els.backdrop.classList.contains("is-open")) ||
            (els.downloadBackdrop &&
                els.downloadBackdrop.classList.contains("is-open")) ||
            (els.lightbox && els.lightbox.classList.contains("is-open"))
        );
    }

    function syncBodyScroll() {
        document.body.classList.toggle("modal-open", anyModalOpen());
    }

    function openLightbox(src, alt) {
        if (!els.lightbox || !els.lightboxImg || !src) return;
        lastFocus = document.activeElement;
        els.lightboxImg.src = src;
        els.lightboxImg.alt = alt || "";
        els.lightbox.classList.add("is-open");
        els.lightbox.setAttribute("aria-hidden", "false");
        syncBodyScroll();
        if (els.lightboxClose) els.lightboxClose.focus();
    }

    function closeLightbox() {
        if (!els.lightbox || !els.lightbox.classList.contains("is-open")) return;
        els.lightbox.classList.remove("is-open");
        els.lightbox.setAttribute("aria-hidden", "true");
        els.lightboxImg.removeAttribute("src");
        els.lightboxImg.alt = "";
        syncBodyScroll();
        if (lastFocus && typeof lastFocus.focus === "function") {
            lastFocus.focus();
        }
    }

    async function openDownloadModal() {
        if (!els.downloadBackdrop) return;
        lastFocus = document.activeElement;

        if (els.downloadApkLink) {
            els.downloadApkLink.href = APK_URL;
        }

        if (els.downloadVersion) {
            els.downloadVersion.textContent = "Cargando…";
            els.downloadVersion.classList.add("is-loading");
        }

        els.downloadBackdrop.classList.add("is-open");
        els.downloadBackdrop.setAttribute("aria-hidden", "false");
        syncBodyScroll();
        if (els.downloadClose) els.downloadClose.focus();

        const version = await fetchAppVersion();
        if (els.downloadBackdrop.classList.contains("is-open")) {
            setDownloadVersionLabel(version);
        }
    }

    function closeDownloadModal() {
        if (
            !els.downloadBackdrop ||
            !els.downloadBackdrop.classList.contains("is-open")
        ) {
            return;
        }
        els.downloadBackdrop.classList.remove("is-open");
        els.downloadBackdrop.setAttribute("aria-hidden", "true");
        syncBodyScroll();
        if (lastFocus && typeof lastFocus.focus === "function") {
            lastFocus.focus();
        }
    }

    function setModalLogo(title, logoPath) {
        if (logoPath) {
            els.modalLogo.src = `${TMDB_IMG}/w500${logoPath}`;
            els.modalLogo.alt = title;
            els.modalLogo.hidden = false;
            els.modalLogoFallback.hidden = true;
            return;
        }
        els.modalLogo.hidden = true;
        els.modalLogo.removeAttribute("src");
        els.modalLogoFallback.hidden = false;
        els.modalLogoFallback.textContent = title;
    }

    async function fetchTitleLogo(movieId) {
        try {
            const res = await fetch(
                `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${TMDB_KEY}`
            );
            if (!res.ok) return null;
            const data = await res.json();
            const logos = data.logos || [];
            const es = logos.find((l) => l.iso_639_1 === "es");
            const en = logos.find((l) => l.iso_639_1 === "en");
            const any = logos[0];
            return (es || en || any || null)?.file_path || null;
        } catch {
            return null;
        }
    }

    function openModal(movie) {
        if (!movie || !els.backdrop) return;
        closeDownloadModal();
        currentMovie = movie;
        lastFocus = document.activeElement;

        const title = movie.title || movie.name || "Sin título";
        const year = yearFromDate(movie.release_date || movie.first_air_date);
        const genre = primaryGenre(movie.genre_ids);
        const overview =
            movie.overview && movie.overview.trim()
                ? movie.overview
                : "Sin descripción disponible. Descarga LzPlay! para ver más títulos.";

        els.modalHero.style.backgroundImage = `url("${backdropUrl(movie.backdrop_path || movie.poster_path)}")`;
        setModalLogo(title, null);

        els.modalYear.textContent = year;
        els.modalRating.textContent = ratingLabel(movie);
        els.modalType.textContent = "Película";
        els.modalGenre.textContent = genre;
        els.modalSynopsis.textContent = overview;

        els.backdrop.classList.add("is-open");
        els.backdrop.setAttribute("aria-hidden", "false");
        syncBodyScroll();
        els.modalClose.focus();

        if (movie.id) {
            fetchTitleLogo(movie.id).then((path) => {
                if (currentMovie && currentMovie.id === movie.id) {
                    setModalLogo(title, path);
                }
            });
        }
    }

    function closeModal() {
        if (!els.backdrop || !els.backdrop.classList.contains("is-open")) return;
        els.backdrop.classList.remove("is-open");
        els.backdrop.setAttribute("aria-hidden", "true");
        currentMovie = null;
        syncBodyScroll();
        if (
            !els.downloadBackdrop?.classList.contains("is-open") &&
            lastFocus &&
            typeof lastFocus.focus === "function"
        ) {
            lastFocus.focus();
        }
    }

    function renderTrending(movies) {
        if (!els.track) return;
        els.track.innerHTML = "";

        movies.slice(0, 10).forEach((movie, i) => {
            const li = document.createElement("li");
            li.className = "trend-item";

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "trend-card";
            btn.style.backgroundImage = `url("${posterUrl(movie.poster_path)}")`;
            btn.setAttribute("aria-label", `Ver detalles de ${movie.title}`);
            btn.dataset.index = String(i);

            const rank = document.createElement("span");
            rank.className = "trend-rank";
            rank.setAttribute("aria-hidden", "true");
            rank.textContent = String(i + 1);

            const sr = document.createElement("span");
            sr.className = "trend-title-sr";
            sr.textContent = movie.title;

            btn.append(rank, sr);
            btn.addEventListener("click", () => openModal(movie));
            li.appendChild(btn);
            els.track.appendChild(li);
        });
    }

    function startHeroRotation(movies) {
        const paths = movies
            .map((m) => m.backdrop_path)
            .filter(Boolean)
            .slice(0, 8)
            .map((p) => backdropUrl(p));

        if (!paths.length || !els.bg || !els.bg2) {
            if (els.bg) els.bg.style.backgroundImage = `url("${FALLBACK_BACKDROP}")`;
            return;
        }

        let idx = 0;
        let showA = true;
        els.bg.style.backgroundImage = `url("${paths[0]}")`;
        els.bg.style.opacity = "1";
        els.bg2.style.opacity = "0";

        if (paths.length < 2) return;

        setInterval(() => {
            idx = (idx + 1) % paths.length;
            const next = paths[idx];
            if (showA) {
                els.bg2.style.backgroundImage = `url("${next}")`;
                els.bg2.style.opacity = "1";
                els.bg.style.opacity = "0";
            } else {
                els.bg.style.backgroundImage = `url("${next}")`;
                els.bg.style.opacity = "1";
                els.bg2.style.opacity = "0";
            }
            showA = !showA;
        }, 8000);
    }

    async function loadMovies() {
        try {
            const res = await fetch(
                `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=es-ES&page=1`
            );
            if (!res.ok) throw new Error("TMDB error");
            const data = await res.json();
            moviesCache = (data.results || []).filter((m) => m.poster_path);
            startHeroRotation(moviesCache);
            renderTrending(moviesCache);
        } catch {
            if (els.bg) els.bg.style.backgroundImage = `url("${FALLBACK_BACKDROP}")`;
            if (els.track) {
                els.track.innerHTML =
                    '<li class="trend-item" style="color:var(--nf-muted);padding:1rem">No se pudieron cargar las tendencias.</li>';
            }
        }
    }

    function bindUi() {
        document.querySelectorAll("[data-share]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                shareContent();
            });
        });

        document.querySelectorAll("[data-download]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                closeModal();
                openDownloadModal();
            });
        });

        document.querySelectorAll("[data-lightbox]").forEach((el) => {
            el.addEventListener("click", () => {
                openLightbox(
                    el.getAttribute("data-lightbox"),
                    el.getAttribute("data-lightbox-alt") || ""
                );
            });
        });

        if (els.lightboxClose) {
            els.lightboxClose.addEventListener("click", closeLightbox);
        }

        if (els.lightbox) {
            els.lightbox.addEventListener("click", (e) => {
                if (e.target === els.lightbox) closeLightbox();
            });
        }

        if (els.modalShare) {
            els.modalShare.addEventListener("click", () => {
                if (!currentMovie) {
                    shareContent();
                    return;
                }
                shareContent({
                    title: SHARE_TITLE,
                    text: `Mira "${currentMovie.title}" en LzPlay.\n${SHARE_TEXT}`,
                    url: SHARE_URL,
                });
            });
        }

        if (els.modalClose) {
            els.modalClose.addEventListener("click", closeModal);
        }

        if (els.backdrop) {
            els.backdrop.addEventListener("click", (e) => {
                if (e.target === els.backdrop) closeModal();
            });
        }

        if (els.downloadClose) {
            els.downloadClose.addEventListener("click", closeDownloadModal);
        }

        if (els.downloadBackdrop) {
            els.downloadBackdrop.addEventListener("click", (e) => {
                if (e.target === els.downloadBackdrop) closeDownloadModal();
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;
            if (els.lightbox?.classList.contains("is-open")) {
                closeLightbox();
                return;
            }
            if (els.downloadBackdrop?.classList.contains("is-open")) {
                closeDownloadModal();
                return;
            }
            closeModal();
        });
    }

    bindUi();
    loadMovies();
    fetchAppVersion();
    getShareImageFile();
})();
