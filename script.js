/**
 * CyberStream Engine v4.0 - Premium Edition
 * Especialista em Processamento de Listas Massivas e Xtream API
 */
"use strict";

const PROXY = ""; // Caso configure um proxy Node.js, coloque o path aqui (Ex: /proxy?url=)

const state = {
    playlists: JSON.parse(localStorage.getItem('cs_playlists') || '[]'),
    currentPlaylist: null,
    data: { live: [], movie: [], series: [] },
    filtered: [],
    categories: [],
    type: 'live', // live | movie | series
    favorites: JSON.parse(localStorage.getItem('cs_favs') || '[]'),
    page: 1,
    perPage: 40,
    hls: null
};

// --- CORE ENGINE ---

/**
 * Inicializa a aplicação
 */
const init = () => {
    renderPortal();
    bindEvents();
};

const bindEvents = () => {
    // Modal controls
    document.getElementById('openAddModal').onclick = () => document.getElementById('addModal').classList.remove('hidden');
    document.getElementById('closeAddModal').onclick = () => document.getElementById('addModal').classList.add('hidden');
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active', 'hidden'));
            btn.classList.add('active');
            const target = btn.dataset.tab === 'm3u' ? 'm3uFields' : 'xtreamFields';
            const other = btn.dataset.tab === 'm3u' ? 'xtreamFields' : 'm3uFields';
            document.getElementById(target).classList.remove('hidden');
            document.getElementById(other).classList.add('hidden');
        };
    });

    // Save Playlist
    document.getElementById('savePlaylistBtn').onclick = async () => {
        const isXtream = document.querySelector('.tab-btn[data-tab="xtream"]').classList.contains('active');
        const list = isXtream ? {
            type: 'xtream',
            name: document.getElementById('xtName').value,
            host: document.getElementById('xtHost').value,
            user: document.getElementById('xtUser').value,
            pass: document.getElementById('xtPass').value
        } : {
            type: 'm3u',
            name: document.getElementById('m3uName').value,
            url: document.getElementById('m3uUrl').value
        };

        state.playlists.push(list);
        localStorage.setItem('cs_playlists', JSON.stringify(state.playlists));
        location.reload();
    };

    // Navigation
    document.querySelectorAll('.nav-btn[data-type]').forEach(btn => {
        btn.onclick = () => switchType(btn.dataset.type);
    });

    // Search & Close Player
    document.getElementById('mainSearch').oninput = (e) => debounceSearch(e.target.value);
    document.querySelector('.close-player').onclick = () => {
        document.getElementById('playerOverlay').classList.add('hidden');
        if (state.hls) state.hls.destroy();
    };
};

/**
 * Renderiza o portal de seleção (Estilo IBO)
 */
const renderPortal = () => {
    const grid = document.getElementById('playlistGrid');
    const items = state.playlists.map((pl, idx) => `
        <div class="playlist-card" onclick="CyberEngine.connect(${idx})">
            <div class="icon">${pl.type === 'xtream' ? '☁️' : '📄'}</div>
            <h3>${pl.name}</h3>
            <p>${pl.type.toUpperCase()}</p>
        </div>
    `).join('');
    grid.insertAdjacentHTML('afterbegin', items);
};

/**
 * Motor de Conexão e Parsing
 */
const CyberEngine = {
    async connect(idx) {
        toggleLoader(true);
        const pl = state.playlists[idx];
        state.currentPlaylist = pl;

        try {
            if (pl.type === 'xtream') {
                await this.fetchXtream(pl);
            } else {
                await this.fetchM3U(pl.url);
            }
            
            document.getElementById('portalScreen').classList.add('hidden');
            document.getElementById('playerScreen').classList.remove('hidden');
            switchType('live');
        } catch (err) {
            alert("Erro ao conectar na lista: " + err.message);
        } finally {
            toggleLoader(false);
        }
    },

    async fetchM3U(url) {
        const response = await fetch(PROXY + url);
        const text = await response.text();
        this.parseM3U(text);
    },

    parseM3U(content) {
        const lines = content.split('\n');
        state.data = { live: [], movie: [], series: [] };
        let current = null;

        lines.forEach(line => {
            if (line.startsWith('#EXTINF:')) {
                const name = line.split(',').pop().trim();
                const logo = line.match(/tvg-logo="([^"]*)"/)?.[1] || '';
                const group = line.match(/group-title="([^"]*)"/)?.[1] || 'Geral';
                current = { name, logo, group };
            } else if (line.startsWith('http')) {
                if (current) {
                    current.url = line.trim();
                    const u = current.url.toLowerCase();
                    if (u.includes('/movie/') || u.endsWith('.mp4')) state.data.movie.push(current);
                    else if (u.includes('/series/')) state.data.series.push(current);
                    else state.data.live.push(current);
                    current = null;
                }
            }
        });
    },

    async fetchXtream(pl) {
        // Exemplo simplificado de Xtream VOD/LIVE fetch
        const baseUrl = `${pl.host}/player_api.php?username=${pl.user}&password=${pl.pass}`;
        const [live, movies, series] = await Promise.all([
            fetch(`${baseUrl}&action=get_live_streams`).then(r => r.json()),
            fetch(`${baseUrl}&action=get_vod_streams`).then(r => r.json()),
            fetch(`${baseUrl}&action=get_series`).then(r => r.json())
        ]);

        state.data.live = live.map(i => ({ name: i.name, logo: i.stream_icon, group: i.category_id, url: `${pl.host}/live/${pl.user}/${pl.pass}/${i.stream_id}.m3u8` }));
        state.data.movie = movies.map(i => ({ name: i.name, logo: i.stream_icon, group: i.category_id, url: `${pl.host}/movie/${pl.user}/${pl.pass}/${i.stream_id}.${i.container_extension}` }));
        state.data.series = series.map(i => ({ name: i.name, logo: i.last_modified, group: i.category_id, stream_id: i.series_id }));
    }
};

/**
 * UI & Renderização de Mídia
 */
const switchType = (type) => {
    state.type = type;
    state.page = 1;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    
    // Gerar categorias
    const cats = [...new Set(state.data[type].map(i => i.group))];
    const catBar = document.getElementById('categoryBar');
    catBar.innerHTML = `<div class="chip active" onclick="filterCat('all')">Todos</div>` + 
                       cats.map(c => `<div class="chip" onclick="filterCat('${c}')">${c}</div>`).join('');
    
    state.filtered = state.data[type];
    renderGrid();
};

window.filterCat = (cat) => {
    state.filtered = cat === 'all' ? state.data[state.type] : state.data[state.type].filter(i => i.group === cat);
    state.page = 1;
    renderGrid();
};

const renderGrid = (append = false) => {
    const grid = document.getElementById('mediaGrid');
    if (!append) grid.innerHTML = '';
    
    const start = (state.page - 1) * state.perPage;
    const end = start + state.perPage;
    const items = state.filtered.slice(start, end);

    const html = items.map(item => `
        <div class="media-card" onclick="playMedia('${item.url}', '${item.name}')">
            <img src="${item.logo}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=Sem+Imagem'">
            <div class="info">${item.name}</div>
        </div>
    `).join('');

    grid.insertAdjacentHTML('beforeend', html);
};

/**
 * Player Engine
 */
window.playMedia = (url, name) => {
    const overlay = document.getElementById('playerOverlay');
    const video = document.getElementById('mainVideo');
    document.getElementById('videoTitle').textContent = name;
    overlay.classList.remove('hidden');

    if (state.hls) state.hls.destroy();

    if (Hls.isSupported() && (url.includes('.m3u8') || state.type === 'live')) {
        state.hls = new Hls();
        state.hls.loadSource(url);
        state.hls.attachMedia(video);
        state.hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        video.src = url;
        video.play().catch(e => alert("Erro ao carregar stream. Verifique o suporte do servidor."));
    }
};

// --- UTILS ---
const toggleLoader = (show) => document.getElementById('globalLoader').classList.toggle('hidden', !show);

let searchTimer;
const debounceSearch = (term) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        state.filtered = state.data[state.type].filter(i => i.name.toLowerCase().includes(term.toLowerCase()));
        state.page = 1;
        renderGrid();
    }, 400);
};

// Infinite Scroll
document.querySelector('.media-grid').onscroll = function() {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) {
        if (state.page * state.perPage < state.filtered.length) {
            state.page++;
            renderGrid(true);
        }
    }
};

init();