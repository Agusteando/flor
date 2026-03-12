<template>
  <div class="app-wrapper">
    <!-- Initial Loading State -->
    <div v-if="pending" id="global-loader">
      <div class="spinner-border" style="width: 3rem; height: 3rem; color: var(--accent);" role="status"></div>
      <div class="mt-3 font-weight-bold" style="color: var(--text-main);">Cargando biblioteca…</div>
    </div>

    <div v-else class="app-layout">
      
      <!-- ========================================== -->
      <!-- SIDEBAR (MASTER LIST)                      -->
      <!-- ========================================== -->
      <aside class="sidebar" :class="{ 'mobile-hidden': !showListOnMobile }">
        
        <!-- Sidebar Header (Brand & Search) -->
        <div class="sidebar-header">
          <div class="brand-area">
            <img src="https://admin.casitaiedis.edu.mx/img/IECS-FULL.png" alt="Logo IECS" class="brand-logo" />
            <h1 class="brand-title">Casita del Saber</h1>
          </div>
          
          <div class="search-wrap">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input 
              v-model="searchText"
              class="search-input" 
              type="search" 
              placeholder="Buscar en resúmenes..." 
              autocomplete="off" 
            />
          </div>
          
          <!-- NEW: Export / Compilation Button -->
          <div class="mt-3">
             <NuxtLink to="/export" class="action-btn text-btn w-100 justify-content-center" style="background: var(--accent-light); color: var(--accent); text-decoration: none;">
               <i class="fa-solid fa-layer-group mr-2"></i> Compilar Resúmenes
             </NuxtLink>
          </div>
        </div>

        <!-- Sidebar List -->
        <div class="sidebar-list scroll-y">
          <div v-if="filteredData.length === 0" class="empty-state">
            <i class="fa-regular fa-folder-open mb-2"></i>
            <p>No se encontraron resultados</p>
          </div>

          <div 
            v-for="(item, index) in paginatedData" 
            :key="item.id"
            class="list-item"
            :class="{ active: selectedItem && selectedItem.id === item.id }"
            @click="selectItem(item, index)"
          >
            <div class="list-item-thumb">
              <img :src="getThumb(item)" alt="" loading="lazy" @error="handleImageError(item, $event)" />
              <div class="play-indicator"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="list-item-content">
              <h3 class="list-item-title">{{ item.videoTitle || 'Sin título' }}</h3>
              <p class="list-item-snippet">{{ formatSnippet(item.summary) }}</p>
            </div>
          </div>
        </div>

        <!-- Sidebar Footer (Pagination) -->
        <div class="sidebar-footer" v-if="totalPages > 1">
          <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <span class="page-info">{{ currentPage }} de {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </aside>

      <!-- ========================================== -->
      <!-- MAIN CONTENT (DETAIL VIEW)                 -->
      <!-- ========================================== -->
      <main 
        class="main-content" 
        :class="{ 'mobile-hidden': showListOnMobile }"
        @touchstart="onTouchStart" 
        @touchend="onTouchEnd"
      >
        <template v-if="selectedItem">
          <!-- Main Header Toolbar -->
          <header class="content-header">
            <div class="header-left">
              <button class="icon-btn d-lg-none mr-2" @click="goBackToList" aria-label="Volver">
                <i class="fa-solid fa-arrow-left"></i>
              </button>
              <div class="content-title-marquee">
                <h2>{{ selectedItem.videoTitle || selectedItem.name }}</h2>
              </div>
            </div>
            
            <div class="header-actions">
              <button class="action-btn text-btn" title="Aumentar Texto" @click="increaseFontSize">
                <i class="fa-solid fa-text-height"></i>
              </button>
              <button class="action-btn ai-btn" title="Mejorar Resumen con IA" @click="regenerateSummary(selectedItem.id)">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span class="d-none d-md-inline ml-2">Mejorar AI</span>
              </button>
              <div class="nav-divider"></div>
              <button class="icon-btn" title="Anterior" :disabled="!hasPrev" @click="navigatePrev">
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <button class="icon-btn" title="Siguiente" :disabled="!hasNext" @click="navigateNext">
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>
          </header>

          <!-- Scrollable Reading Area -->
          <div class="content-body scroll-y" ref="readingArea">
            <div class="reading-container" :class="animationClass">
              
              <!-- Video Player -->
              <div class="video-wrapper">
                <iframe 
                  ref="ytIframe"
                  :src="ensureYTApi(selectedItem.embedUrl)" 
                  allow="autoplay; encrypted-media; picture-in-picture" 
                  allowfullscreen
                  :title="selectedItem.videoTitle">
                </iframe>
              </div>

              <!-- Article Summary -->
              <article class="summary-article">
                <div class="article-meta">
                  <span class="badge-tag"><i class="fa-solid fa-book-open mr-2"></i> Resumen Oficial</span>
                </div>
                
                <div 
                  class="md-content" 
                  :style="{ fontSize: currentFontSize + 'px' }" 
                  v-html="renderMarkdown(currentSummaryContent)"
                ></div>
              </article>
              
              <!-- Bottom Spacing -->
              <div style="height: 60px;"></div>
            </div>
          </div>
        </template>
        
        <!-- Desktop Empty State -->
        <div v-else class="desktop-empty-state">
          <div class="empty-icon-large">
            <i class="fa-regular fa-compass"></i>
          </div>
          <h2>Selecciona una conferencia</h2>
          <p>Elige un tema del menú lateral para comenzar a leer su resumen y ver el video.</p>
        </div>
      </main>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useFetch, useHead } from '#imports';

// --- Data Fetching ---
const { data: pageData, pending } = await useFetch('/api/page-data');

// --- Global Config ---
const USE_SYNTH_THUMBS = true;
const thumbCache = new Map();

// --- Reactive State ---
const searchText = ref('');
const currentPage = ref(1);
const itemsPerPage = ref(12); // Increased for sidebar
const selectedItem = ref(null);
const showListOnMobile = ref(true);
const animationClass = ref('');
const readingArea = ref(null);
const ytIframe = ref(null);
const currentFontSize = ref(17);

// --- Meta Tags ---
useHead(() => {
  const item = selectedItem.value || (pageData.value && pageData.value[0]);
  return {
    title: item ? item.videoTitle : 'Programa de Formación Casita del Saber',
    meta: [
      { name: 'description', content: item ? item.summary : 'Programa de Formación' },
      { property: 'og:title', content: item ? item.videoTitle : 'Programa de Formación Casita del Saber' },
      { property: 'og:description', content: item ? item.summary : 'Programa de Formación' },
    ]
  };
});

// --- Computed Filters & Pagination ---
const filteredData = computed(() => {
  if (!pageData.value) return [];
  const query = searchText.value.toLowerCase().trim();
  if (!query) return pageData.value;
  
  return pageData.value.filter(item => {
    const t = (item.videoTitle || '').toLowerCase();
    const sum = (item.summary || '').toLowerCase();
    const tr = (item.transcriptionContent || '').toLowerCase();
    return t.includes(query) || sum.includes(query) || tr.includes(query);
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage.value)));

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredData.value.slice(start, start + itemsPerPage.value);
});

const currentItemGlobalIndex = computed(() => {
  if (!selectedItem.value) return -1;
  return filteredData.value.findIndex(item => item.id === selectedItem.value.id);
});

const hasNext = computed(() => currentItemGlobalIndex.value >= 0 && currentItemGlobalIndex.value < filteredData.value.length - 1);
const hasPrev = computed(() => currentItemGlobalIndex.value > 0);

const currentSummaryContent = computed(() => {
  if (!selectedItem.value) return '';
  const item = selectedItem.value;
  return (item.summary && item.summary.trim().length) ? item.summary : (item.transcriptionContent || '— No hay resumen disponible para este contenido —');
});

// --- Watchers & Lifecycle ---
watch(searchText, () => {
  currentPage.value = 1;
});

onMounted(() => {
  // On Desktop, auto-select the first item to populate the reading area
  if (window.innerWidth >= 992 && filteredData.value.length > 0) {
    selectedItem.value = filteredData.value[0];
    showListOnMobile.value = false;
  }
});

// --- Methods ---
const selectItem = (item, index) => {
  if (selectedItem.value && selectedItem.value.id === item.id) {
    showListOnMobile.value = false; // Just switch view on mobile if already selected
    return; 
  }
  
  stopVideo();
  animationClass.value = 'fade-out';
  
  setTimeout(() => {
    selectedItem.value = item;
    showListOnMobile.value = false;
    animationClass.value = 'fade-in';
    
    // Scroll to top of reading area
    if (readingArea.value) readingArea.value.scrollTop = 0;
    
    setTimeout(() => { animationClass.value = ''; }, 250);
  }, 150);
};

const goBackToList = () => {
  showListOnMobile.value = true;
  stopVideo();
};

const stopVideo = () => {
  if (ytIframe.value) {
    try { ytIframe.value.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); } catch (e) {}
  }
};

const navigateNext = () => {
  if (hasNext.value) {
    const nextItem = filteredData.value[currentItemGlobalIndex.value + 1];
    handlePaginationSync(currentItemGlobalIndex.value + 1);
    selectItem(nextItem);
  }
};

const navigatePrev = () => {
  if (hasPrev.value) {
    const prevItem = filteredData.value[currentItemGlobalIndex.value - 1];
    handlePaginationSync(currentItemGlobalIndex.value - 1);
    selectItem(prevItem);
  }
};

const handlePaginationSync = (globalIndex) => {
  const targetPage = Math.floor(globalIndex / itemsPerPage.value) + 1;
  if (currentPage.value !== targetPage) {
    currentPage.value = targetPage;
  }
};

const increaseFontSize = () => {
  if (currentFontSize.value >= 24) {
    currentFontSize.value = 15; // Reset
  } else {
    currentFontSize.value += 2;
  }
};

// --- Formatting & Parsing ---
const formatSnippet = (s) => {
  s = s || '';
  return s.length > 80 ? s.slice(0, 80) + '...' : s;
};

const renderMarkdown = (text) => {
  if (!text) return '';
  const fixed = text.replace(/INSS/g, 'IMSS');
  marked.setOptions({ headerIds: false, mangle: false, breaks: true });
  const raw = marked.parse(fixed);
  if (import.meta.server) return raw; 
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
};

const ensureYTApi = (url) => {
  if (import.meta.server) return url || '';
  try {
    if (!url) return '';
    const u = new URL(url, window.location.href);
    if ((u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) && !u.searchParams.has('enablejsapi')) {
      u.searchParams.set('enablejsapi', '1');
    }
    return u.toString();
  } catch { return url; }
};

// --- Touch/Swipe Logic for Mobile Reading Area ---
let touchStartX = 0, touchEndX = 0;
const onTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
const onTouchEnd = (e) => {
  touchEndX = e.changedTouches[0].screenX;
  if (Math.abs(touchEndX - touchStartX) > 60) {
    if (touchEndX < touchStartX) navigateNext(); // Swipe Left -> Next
    else navigatePrev(); // Swipe Right -> Prev
  }
};

// --- Thumbnails Fallback System ---
const generateThumbCanvas = (title) => {
  if (import.meta.server) return ''; 
  const key = (title || 'Conferencia').trim() || 'Conferencia';
  if (thumbCache.has(key)) return thumbCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 180;
  const ctx = canvas.getContext('2d');

  const palettes = [
    ['#4F46E5', '#3B82F6'], ['#0ea5e9', '#0284c7'], ['#10b981', '#059669'], 
    ['#8b5cf6', '#6d28d9'], ['#f59e0b', '#d97706'], ['#f43f5e', '#e11d48']
  ];
  let h = 0; for(let i=0; i<key.length; i++){h=(h<<5)-h+key.charCodeAt(i);h|=0;}
  const pal = palettes[Math.abs(h) % palettes.length];

  const grd = ctx.createLinearGradient(0,0,320,180);
  grd.addColorStop(0, pal[0]); grd.addColorStop(1, pal[1]);
  ctx.fillStyle = grd; ctx.fillRect(0,0,320,180);

  ctx.fillStyle = 'rgba(255,255,255,0.15)'; 
  ctx.beginPath(); ctx.arc(160, 90, 40, 0, Math.PI*2); ctx.fill();

  const url = canvas.toDataURL('image/jpeg', 0.8);
  thumbCache.set(key, url);
  return url;
};

const getThumb = (item) => {
  if (import.meta.server) return item.thumbnailLink || '';
  return USE_SYNTH_THUMBS ? generateThumbCanvas(item.videoTitle || item.name) : (item.thumbnailLink || generateThumbCanvas(item.videoTitle || item.name));
};

const handleImageError = (item, event) => {
  event.target.src = generateThumbCanvas(item.videoTitle || item.name);
};

// --- AI Regeneration ---
const regenerateSummary = async (videoId) => {
  if (!window.Swal) return;
  const res = await window.Swal.fire({
    title: 'Mejorar con IA',
    input: 'textarea',
    inputLabel: 'Instrucciones para la Inteligencia Artificial',
    inputValue: 'Resume los puntos clave del video en una estructura clara y detallada.',
    showCancelButton: true,
    confirmButtonColor: '#4F46E5',
    cancelButtonColor: '#9CA3AF',
    confirmButtonText: 'Generar',
    cancelButtonText: 'Cancelar',
    customClass: { 
      popup: 'swal-modern-popup',
      title: 'swal-modern-title',
      input: 'swal-modern-input'
    }
  });

  if (!res.value) return;

  window.Swal.fire({ 
    title: 'Analizando contenido...', 
    text: 'Reescribiendo el resumen, por favor espera.',
    allowOutsideClick: false, 
    customClass: { popup: 'swal-modern-popup' },
    didOpen: () => window.Swal.showLoading() 
  });

  try {
    const response = await $fetch('/regenerate-summary', {
      method: 'POST',
      body: { videoId, prompt: res.value }
    });
    
    // Update reactivity locally
    const originalItem = pageData.value.find(d => d.id === videoId);
    if (originalItem) originalItem.summary = response.summary;
    
    window.Swal.fire({ icon: 'success', title: '¡Resumen Mejorado!', timer: 1500, showConfirmButton: false, customClass: { popup: 'swal-modern-popup' } });
  } catch (error) {
    window.Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el resumen.', customClass: { popup: 'swal-modern-popup' } });
  }
};
</script>

<style>
/* ==========================================================================
   MASTER-DETAIL UX/UI DESIGN (Documentation Style)
   ========================================================================== */

:root {
  --bg-sidebar: #F8FAFC;
  --bg-main: #FFFFFF;
  --bg-hover: #F1F5F9;
  
  --text-main: #0F172A;
  --text-muted: #64748B;
  --text-light: #94A3B8;
  
  --accent: #4F46E5;
  --accent-hover: #4338CA;
  --accent-light: #EEF2FF;
  
  --border-color: #E2E8F0;
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  
  --font-stack: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --sidebar-width: 380px;
}

/* Global Reset for App-Like Feel */
html, body {
  margin: 0; padding: 0; height: 100%; overflow: hidden;
  font-family: var(--font-stack); color: var(--text-main);
  background-color: var(--bg-main);
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
.scroll-y { overflow-y: auto; overflow-x: hidden; }

/* Loader */
#global-loader {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100vh; width: 100vw; background: var(--bg-main);
}

/* App Wrapper */
.app-wrapper { height: 100vh; width: 100vw; display: flex; flex-direction: column; }
.app-layout { display: flex; height: 100%; flex: 1; overflow: hidden; position: relative; }

/* ==================== SIDEBAR ==================== */
.sidebar {
  width: var(--sidebar-width); flex-shrink: 0;
  background-color: var(--bg-sidebar); border-right: 1px solid var(--border-color);
  display: flex; flex-direction: column; z-index: 10;
  transition: transform 0.3s ease;
}

.sidebar-header { padding: 24px 24px 16px; border-bottom: 1px solid var(--border-color); }
.brand-area { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.brand-logo { height: 36px; border-radius: 4px; }
.brand-title { font-size: 1.25rem; font-weight: 800; margin: 0; color: var(--text-main); letter-spacing: -0.02em; }

.search-wrap { position: relative; }
.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-light); }
.search-input {
  width: 100%; padding: 12px 14px 12px 40px; border-radius: 8px;
  border: 1px solid var(--border-color); background: var(--bg-main);
  font-size: 0.95rem; color: var(--text-main); outline: none; transition: border-color 0.2s;
}
.search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }

.sidebar-list { flex: 1; padding: 12px; }
.empty-state { text-align: center; padding: 40px 20px; color: var(--text-light); }
.empty-state i { font-size: 2rem; }

.list-item {
  display: flex; gap: 12px; padding: 12px; margin-bottom: 8px;
  border-radius: 10px; cursor: pointer; transition: all 0.2s;
  border: 1px solid transparent;
}
.list-item:hover { background-color: var(--bg-hover); }
.list-item.active { background-color: var(--bg-main); border-color: var(--border-color); box-shadow: var(--shadow-sm); }

.list-item-thumb { position: relative; width: 100px; height: 56px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: var(--border-color); }
.list-item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.play-indicator {
  position: absolute; inset: 0; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center; color: white; opacity: 0; transition: opacity 0.2s;
}
.list-item:hover .play-indicator { opacity: 1; }

.list-item-content { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.list-item-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list-item-snippet { font-size: 0.8rem; color: var(--text-muted); margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.sidebar-footer {
  padding: 16px; border-top: 1px solid var(--border-color);
  display: flex; align-items: center; justify-content: space-between; background: var(--bg-sidebar);
}
.page-btn {
  background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 6px;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  color: var(--text-main); cursor: pointer; transition: background 0.2s;
}
.page-btn:hover:not(:disabled) { background: var(--bg-hover); }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }

/* ==================== MAIN CONTENT ==================== */
.main-content {
  flex: 1; display: flex; flex-direction: column; background: var(--bg-main);
  position: relative; overflow: hidden;
}

.content-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 32px; border-bottom: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); z-index: 5;
}
.header-left { display: flex; align-items: center; min-width: 0; flex: 1; }
.content-title-marquee h2 {
  font-size: 1.15rem; font-weight: 800; margin: 0; color: var(--text-main);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}

.header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 20px; }
.icon-btn, .action-btn {
  background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px;
  height: 36px; display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); cursor: pointer; transition: all 0.2s; font-weight: 600; font-size: 0.9rem;
}
.icon-btn { width: 36px; }
.action-btn { padding: 0 16px; }
.icon-btn:hover:not(:disabled), .action-btn:hover { background: var(--bg-hover); color: var(--text-main); border-color: #CBD5E1; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.ai-btn { color: var(--accent); border-color: var(--accent-light); background: var(--accent-light); }
.ai-btn:hover { background: var(--accent); color: white; border-color: var(--accent); }
.nav-divider { width: 1px; height: 24px; background: var(--border-color); margin: 0 4px; }

/* Desktop Empty State */
.desktop-empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; text-align: center; padding: 40px; color: var(--text-muted);
}
.empty-icon-large { font-size: 4rem; color: var(--border-color); margin-bottom: 24px; }

/* Reading Area */
.content-body { flex: 1; padding: 40px; scroll-behavior: smooth; }
.reading-container { max-width: 800px; margin: 0 auto; transition: opacity 0.2s; }

.video-wrapper {
  width: 100%; aspect-ratio: 16/9; background: #000;
  border-radius: 16px; overflow: hidden; margin-bottom: 40px;
  box-shadow: var(--shadow-md); border: 1px solid var(--border-color);
}
.video-wrapper iframe { width: 100%; height: 100%; border: none; display: block; }

.summary-article { background: var(--bg-main); }
.article-meta { margin-bottom: 24px; }
.badge-tag {
  display: inline-flex; align-items: center; padding: 6px 12px;
  background: var(--bg-hover); color: var(--text-main); border-radius: 99px;
  font-size: 0.85rem; font-weight: 700; border: 1px solid var(--border-color);
}

/* Markdown Styling inside Reader */
.md-content { line-height: 1.8; color: #334155; transition: font-size 0.2s ease; }
.md-content h1, .md-content h2, .md-content h3 { color: #0F172A; margin-top: 1.8em; margin-bottom: 0.8em; font-weight: 800; line-height: 1.3; }
.md-content p { margin-bottom: 1.5em; }
.md-content strong { color: var(--accent); font-weight: 700; }
.md-content blockquote {
  border-left: 4px solid var(--accent); background: var(--bg-sidebar);
  padding: 16px 24px; border-radius: 0 12px 12px 0; font-style: italic; color: #475569; margin: 2em 0;
}
.md-content ul { padding-left: 24px; margin-bottom: 1.5em; }
.md-content ul li { margin-bottom: 0.75em; }
.md-content ul li::marker { color: var(--accent); }

/* Animations */
.fade-in { opacity: 1; }
.fade-out { opacity: 0; }

/* SweetAlert Modern Reset */
.swal-modern-popup { border-radius: 16px !important; padding: 32px !important; }
.swal-modern-title { font-family: var(--font-stack) !important; font-weight: 800 !important; color: var(--text-main) !important; }
.swal-modern-input { border-radius: 8px !important; font-family: var(--font-stack) !important; border-color: var(--border-color) !important; }

/* ==================== RESPONSIVE RULES ==================== */
@media (max-width: 991px) {
  .sidebar {
    width: 100%; position: absolute; top: 0; left: 0; height: 100%;
    z-index: 20; border-right: none;
  }
  .main-content {
    width: 100%; position: absolute; top: 0; left: 0; height: 100%;
    z-index: 30;
  }
  .mobile-hidden { display: none !important; }
  
  .content-header { padding: 12px 16px; }
  .content-title-marquee h2 { font-size: 1.05rem; }
  .action-btn { padding: 0 12px; }
  
  .content-body { padding: 20px 16px; }
  .video-wrapper { border-radius: 12px; margin-bottom: 24px; }
}
</style>