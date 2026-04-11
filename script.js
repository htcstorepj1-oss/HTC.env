/**
 * CyberStream IPTV Engine - 2024/2025
 * Focado em alto desempenho para listas gigantes.
 */
"use strict";

const state = {
    allChannels: [],
    filteredChannels: [],
    categories: new Set(['Todos', 'Favoritos']),
    favorites: JSON.parse(localStorage.getItem('cyber_favs') || '[]'),
    currentIndex: 0,
    itemsPerLoad: 60, // Chunk de carregamento
    currentHls: null
};

// Elementos DOM
const dom = {
    video: document.getElementById('mainVideo'),
    channelList: document.getElementById('channelList'),
    searchInput: document.getElementById('searchInput'),
    m3uUrl: document.getElementById('m3uUrl'),
    loadBtn: document.getElementById('loadBtn'),
    fileInput: document.getElementById('fileInput'),
    categoryBar: document.getElementById('categoryBar'),
    sentinel: document.getElementById('listSentinel')
};

/**
 * Parser M3U Otimizado (Regex de alta performance)
 */
const parseM3U = (data) => {
    const channels = [];
    const lines = data.split('\n');
    let currentChannel = null;

    for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
            const info = line.split(',');
            const metadata = info[0];
            const name = info.slice(1).join(',').trim();
            
            // Regex para extrair atributos do M3U
            const logo = metadata.match(/tvg-logo="([^"]*)"/)?.[1] || '';
            const group = metadata.match(/group-title="([^"]*)"/)?.[1] || 'Outros';

            currentChannel = { name, logo, group, url: '' };
            state.categories.add(group);
        } else if (line.startsWith('http') && currentChannel) {
            currentChannel.url = line.trim();
            channels.push(currentChannel);
            currentChannel = null;
        }
    }
    return channels;
};

/**
 * Renderização Progressiva (Lazy Rendering)
 */
const renderChannels = (append = false) => {
    if (!append) {
        dom.channelList.innerHTML = '';
        state.currentIndex = 0;
    }

    const fragment = document.createDocumentFragment();
    const nextBatch = state.filteredChannels.slice(
        state.currentIndex, 
        state.currentIndex + state.itemsPerLoad
    );

    nextBatch.forEach(channel => {
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.innerHTML = `
            <img src="${channel.logo || 'https://via.placeholder.com/100?text=TV'}" 
                 loading="lazy" 
                 onerror="this.src='https://via.placeholder.com/100?text=IPTV'">
            <span>${channel.name}</span>
        `;
        card.onclick = () => playStream(channel);
        fragment.appendChild(card);
    });

    dom.channelList.appendChild(fragment);
    state.currentIndex += state.itemsPerLoad;
};

/**
 * Player Engine (HLS.js)
 */
const playStream = (channel) => {
    const { url, name, group } = channel;
    document.getElementById('currentChannelName').textContent = name;
    document.getElementById('currentChannelGroup').textContent = group;

    if (state.currentHls) {
        state.currentHls.destroy();
    }

    if (Hls.isSupported() && url.includes('.m3u8')) {
        const hls = new Hls({
            capLevelToPlayerSize: true,
            lowLatencyMode: true
        });
        hls.loadSource(url);
        hls.attachMedia(dom.video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => dom.video.play());
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) console.error("Erro fatal na stream:", data.type);
        });
        state.currentHls = hls;
    } else {
        // Fallback para MP4 ou browsers com suporte nativo (Safari)
        dom.video.src = url;
        dom.video.play().catch(e => console.warn("Autoplay bloqueado ou erro na stream"));
    }
};

/**
 * Observer para Scroll Infinito
 */
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && state.currentIndex < state.filteredChannels.length) {
        renderChannels(true);
    }
}, { threshold: 0.1 });

observer.observe(dom.sentinel);

/**
 * Lógica de Categorias e Busca
 */
const updateCategoriesUI = () => {
    dom.categoryBar.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat;
        btn.onclick = () => filterByCategory(cat);
        dom.categoryBar.appendChild(btn);
    });
};

const filterByCategory = (category) => {
    if (category === 'Todos') {
        state.filteredChannels = [...state.allChannels];
    } else if (category === 'Favoritos') {
        state.filteredChannels = state.allChannels.filter(c => state.favorites.includes(c.url));
    } else {
        state.filteredChannels = state.allChannels.filter(c => c.group === category);
    }
    renderChannels();
};

/**
 * Event Listeners
 */
dom.loadBtn.addEventListener('click', async () => {
    const url = dom.m3uUrl.value;
    if (!url) return alert("Insira uma URL válida");

    try {
        dom.loadBtn.textContent = "Baixando...";
        const response = await fetch(url);
        const data = await response.text();
        state.allChannels = parseM3U(data);
        state.filteredChannels = [...state.allChannels];
        updateCategoriesUI();
        renderChannels();
    } catch (err) {
        alert("Erro ao carnergar lista. Verifique o CORS do servidor da lista.");
    } finally {
        dom.loadBtn.textContent = "Carregar";
    }
});

// Busca com Debounce para performance
let searchTimeout;
dom.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const term = e.target.value.toLowerCase();
        state.filteredChannels = state.allChannels.filter(c => 
            c.name.toLowerCase().includes(term) || c.group.toLowerCase().includes(term)
        );
        renderChannels();
    }, 300);
});

// Upload de Arquivo
dom.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        state.allChannels = parseM3U(event.target.result);
        state.filteredChannels = [...state.allChannels];
        updateCategoriesUI();
        renderChannels();
    };
    reader.readAsText(file);
});