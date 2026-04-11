/**
 * CyberStream Engine v2 - 2025
 * Otimizado para 10k+ itens e categorização inteligente
 */
"use strict";

const state = {
    db: { live: [], movie: [], series: [] },
    currentType: 'live',
    filteredItems: [],
    displayCount: 50,
    currentIndex: 0,
    hls: null
};

// Seletor Inteligente
const $ = (id) => document.getElementById(id);

/**
 * Lógica de Parsing com Separação de Conteúdo
 */
async function loadList(source, isFile = false) {
    try {
        let text = "";
        if (isFile) {
            text = await source.text();
        } else {
            // Tentativa de contornar CORS via Proxy Público
            const proxy = "https://corsproxy.io/?";
            const response = await fetch(proxy + encodeURIComponent(source));
            if (!response.ok) throw new Error("Erro ao baixar lista");
            text = await response.text();
        }
        
        parseM3U(text);
        showDashboard();
    } catch (err) {
        alert("Falha ao carregar: " + err.message);
    }
}

function parseM3U(content) {
    const lines = content.split('\n');
    state.db = { live: [], movie: [], series: [] };

    let currentItem = null;

    lines.forEach(line => {
        if (line.startsWith('#EXTINF:')) {
            const name = line.split(',').pop().trim();
            const logo = line.match(/tvg-logo="([^"]*)"/)?.[1] || '';
            const group = line.match(/group-title="([^"]*)"/)?.[1] || 'Geral';
            
            currentItem = { name, logo, group };
        } else if (line.startsWith('http')) {
            if (currentItem) {
                currentItem.url = line.trim();
                
                // Inteligência para separar tipo (Regras comuns de IPTV)
                const url = currentItem.url.toLowerCase();
                if (url.includes('/series/') || currentItem.group.toLowerCase().includes('séries')) {
                    state.db.series.push(currentItem);
                } else if (url.includes('/movie/') || url.endsWith('.mp4') || url.endsWith('.mkv')) {
                    state.db.movie.push(currentItem);
                } else {
                    state.db.live.push(currentItem);
                }
                currentItem = null;
            }
        }
    });

    $('count-live').textContent = `${state.db.live.length} itens`;
    $('count-movie').textContent = `${state.db.movie.length} itens`;
    $('count-series').textContent = `${state.db.series.length} itens`;
}

/**
 * Controle de Interface
 */
function showDashboard() {
    $('setupScreen').classList.add('hidden');
    $('mainDashboard').classList.remove('hidden');
}

function openCategory(type) {
    state.currentType = type;
    state.filteredItems = state.db[type];
    state.currentIndex = 0;
    
    $('categoryGrid').classList.add('hidden');
    $('contentArea').classList.remove('hidden');
    
    renderItems();
}

function renderItems(append = false) {
    if (!append) $('itemList').innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    const chunk = state.filteredItems.slice(state.currentIndex, state.currentIndex + state.displayCount);

    chunk.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <img src="${item.logo}" onerror="this.src='https://via.placeholder.com/150x220?text=Sem+Foto'">
            <p>${item.name.substring(0, 30)}</p>
        `;
        div.onclick = () => play(item);
        fragment.appendChild(div);
    });

    $('itemList').appendChild(fragment);
    state.currentIndex += state.displayCount;
}

/**
 * Player Engine
 */
function play(item) {
    const video = $('mainVideo');
    $('nowPlayingTitle').textContent = item.name;
    $('nowPlayingInfo').textContent = item.group;

    if (state.hls) state.hls.destroy();

    if (Hls.isSupported() && item.url.includes('.m3u8')) {
        state.hls = new Hls();
        state.hls.loadSource(item.url);
        state.hls.attachMedia(video);
        state.hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        video.src = item.url;
        video.play().catch(() => alert("Erro ao reproduzir esta stream. Pode estar offline ou requerer login."));
    }
}

// Eventos
$('loadBtn').onclick = () => loadList($('m3uUrl').value);

$('fileInput').onchange = (e) => loadList(e.target.files[0], true);

document.querySelectorAll('.cat-card').forEach(card => {
    card.onclick = () => openCategory(card.dataset.type);
});

$('backToDash').onclick = () => {
    $('categoryGrid').classList.remove('hidden');
    $('contentArea').classList.add('hidden');
};

$('searchInput').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    state.filteredItems = state.db[state.currentType].filter(i => i.name.toLowerCase().includes(term));
    state.currentIndex = 0;
    renderItems();
};

// Infinite Scroll
$('sidebar').onscroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
        if (state.currentIndex < state.filteredItems.length) renderItems(true);
    }
};