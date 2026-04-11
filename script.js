/**
 * CyberStream Engine v3.0 - IBO Clone Edition
 * Foco em bypass de CORS e performance
 */
"use strict";

const state = {
    playlists: JSON.parse(localStorage.getItem('cyber_playlists') || '[]'),
    currentData: { live: [], movie: [], series: [] },
    filtered: [],
    view: 'live',
    hls: null
};

// Configuração de Proxy para burlar restrições do dono da lista
const PROXY_URL = "https://cors-anywhere.herokuapp.com/"; // Em produção, use um proxy próprio

const dom = {
    manager: document.getElementById('playlistManager'),
    player: document.getElementById('mainPlayer'),
    savedLists: document.getElementById('savedLists'),
    itemsContainer: document.getElementById('itemsContainer'),
    video: document.getElementById('videoPlayer')
};

/**
 * Inicialização e Gerenciamento de Listas
 */
const init = () => {
    renderSavedLists();
    
    document.getElementById('addNewListBtn').onclick = () => document.getElementById('listModal').classList.remove('hidden');
    document.getElementById('closeModalBtn').onclick = () => document.getElementById('listModal').classList.add('hidden');
    
    document.getElementById('saveListBtn').onclick = async () => {
        const name = document.getElementById('listName').value;
        const url = document.getElementById('listUrl').value;
        if (name && url) {
            state.playlists.push({ name, url });
            localStorage.setItem('cyber_playlists', JSON.stringify(state.playlists));
            location.reload();
        }
    };

    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.onclick = (e) => switchView(e.target.dataset.view);
    });
};

const renderSavedLists = () => {
    dom.savedLists.innerHTML = state.playlists.map((list, index) => `
        <div class="playlist-card" onclick="connectToList('${list.url}')">
            <h3>${list.name}</h3>
            <p>M3U Playlist</p>
        </div>
    `).join('');
};

/**
 * Conexão com a Lista (O segredo do Bypass)
 */
async function connectToList(url) {
    try {
        dom.manager.classList.add('hidden');
        document.body.style.cursor = 'wait';

        // Tentamos carregar via proxy para evitar erro de permissão/CORS
        const response = await fetch(url).catch(() => fetch(PROXY_URL + url));
        const data = await response.text();
        
        parseM3U(data);
        dom.player.classList.remove('hidden');
        switchView('live');
    } catch (err) {
        alert("Erro de conexão. A lista pode estar protegida ou o Proxy falhou.");
        dom.manager.classList.remove('hidden');
    } finally {
        document.body.style.cursor = 'default';
    }
}

function parseM3U(content) {
    const lines = content.split('\n');
    state.currentData = { live: [], movie: [], series: [] };
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
                // Lógica de separação IBO
                if (u.includes('movie') || u.endsWith('.mp4') || u.endsWith('.mkv')) {
                    state.currentData.movie.push(current);
                } else if (u.includes('series') || u.includes('s01')) {
                    state.currentData.series.push(current);
                } else {
                    state.currentData.live.push(current);
                }
                current = null;
            }
        }
    });
}

function switchView(view) {
    state.view = view;
    state.filtered = state.currentData[view];
    renderItems();
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
}

function renderItems() {
    dom.itemsContainer.innerHTML = state.filtered.map(item => `
        <div class="media-card" onclick="playMedia('${item.url}', '${item.name}')">
            <img src="${item.logo}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=Sem+Imagem'">
            <span>${item.name.substring(0, 20)}</span>
        </div>
    `).join('');
}

function playMedia(url, name) {
    document.getElementById('viewingTitle').textContent = name;
    
    if (state.hls) state.hls.destroy();

    if (Hls.isSupported() && url.includes('.m3u8')) {
        state.hls = new Hls({
            xhrSetup: (xhr) => {
                // Mimicando um player nativo nos headers
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            }
        });
        state.hls.loadSource(url);
        state.hls.attachMedia(dom.video);
        state.hls.on(Hls.Events.MANIFEST_PARSED, () => dom.video.play());
    } else {
        dom.video.src = url;
        dom.video.play();
    }
}

// Iniciar app
init();