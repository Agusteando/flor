<template>
  <div v-if="pending" id="loader">
    <div class="spinner-border" style="width: 3rem; height: 3rem; color: var(--accent);" role="status"></div>
    <div class="mt-3 font-weight-bold" style="color: var(--text-main);">Cargando biblioteca…</div>
  </div>

  <div class="container-fluid pb-5">
    
    <div class="brand-header text-center">
      <img src="https://admin.casitaiedis.edu.mx/img/IECS-FULL.png" alt="Logo IECS" class="brand-logo" />
      <h1>Programa de Formación Casita del Saber</h1>
      <p class="subtitle">Explora, aprende y repasa nuestros contenidos formativos.</p>
    </div>

    <!-- Enhanced Glassmorphic Search -->
    <div class="search-wrap">
      <div class="position-relative container-fluid px-0" style="max-width: 720px; margin: 0 auto;">
        <input 
          v-model="searchText"
          id="search-input" 
          class="form-control search-input" 
          type="search" 
          inputmode="search" 
          placeholder="¿Qué quieres aprender hoy?" 
          autocomplete="off" 
          aria-label="Buscar" 
        />
        <i class="fa-solid fa-magnifying-glass search-icon"></i>
      </div>
    </div>

    <div class="mt-5">
      <div class="row" id="items-container" role="list">
        <!-- Render Video Cards -->
        <div class="col-12 col-md-6 col-lg-4 mb-4" role="listitem" v-for="item in paginatedData" :key="item.id">
          <div 
            class="video-card h-100" 
            tabindex="0" 
            :aria-label="'Ver ' + (item.videoTitle || 'Video')"
            @click.stop="openMediaModal(filteredData.indexOf(item))"
            @keydown.enter="openMediaModal(filteredData.indexOf(item))"
          >
            <div class="video-thumb">
              <img :src="getThumb(item)" alt="" loading="lazy" @error="handleImageError(item, $event)" />
              <div class="play-badge">
                <i class="fa-solid fa-play"></i>
              </div>
            </div>
            <div class="card-body-custom">
              <div class="video-title">{{ item.videoTitle || 'Sin título' }}</div>
              <div class="video-summary">
                {{ formatSummary(item.summary) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredData.length === 0 && !pending" id="empty-state" class="text-center py-5">
      <div class="empty-icon">
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>
      <h3 class="h4 font-weight-bold mt-4" style="color: var(--text-main);">No encontramos resultados</h3>
      <p style="color: var(--text-muted); font-size: 1.1rem;">Intenta buscar con otras palabras o navega por el catálogo completo.</p>
    </div>

    <!-- Pagination -->
    <nav v-if="filteredData.length > 0" aria-label="Paginación" class="mt-5 pb-4">
      <ul class="pagination justify-content-center flex-wrap" id="pagination">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <a class="page-link" href="#" @click.prevent="goToPage(1)" aria-label="Primera">
            <i class="fa-solid fa-chevron-left"></i>
          </a>
        </li>
        <li 
          class="page-item" 
          v-for="p in visiblePages" 
          :key="p"
          :class="{ active: p === currentPage }"
        >
          <a class="page-link" href="#" @click.prevent="goToPage(p)">{{ p }}</a>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <a class="page-link" href="#" @click.prevent="goToPage(totalPages)" aria-label="Última">
            <i class="fa-solid fa-chevron-right"></i>
          </a>
        </li>
      </ul>
    </nav>
  </div>

  <!-- Teleport the Modal to body -->
  <Teleport to="body">
    <div 
      v-if="selectedItem" 
      class="modal fade show" 
      tabindex="-1" 
      style="display: block; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px);"
      @click.self="closeModal"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div 
          class="modal-content position-relative" 
          :class="animationClass"
          @touchstart="onTouchStart" 
          @touchend="onTouchEnd"
        >
          <!-- Navigation Arrows inside Modal (Floating on Desktop) -->
          <div class="swipe-indicator">
             <button type="button" class="arrow left-arrow" aria-label="Anterior" @click="navigatePrev()">
               <i class="fa-solid fa-chevron-left"></i>
             </button>
             <button type="button" class="arrow right-arrow" aria-label="Siguiente" @click="navigateNext()">
               <i class="fa-solid fa-chevron-right"></i>
             </button>
          </div>
          <div class="page-pill">
            {{ currentItemIndex + 1 }} / {{ filteredData.length }}
          </div>

          <!-- Header -->
          <div class="modal-header">
            <div style="overflow: hidden; margin-right: 15px;">
              <h5 class="modal-title">{{ selectedItem.videoTitle || selectedItem.name || 'Contenido' }}</h5>
            </div>
            <div class="modal-actions">
              <button type="button" class="a11y-btn" title="Aumentar Texto" @click="increaseFontSize">
                <i class="fa-solid fa-text-height"></i>
              </button>
              <button type="button" class="close-btn" @click="closeModal" aria-label="Cerrar">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <!-- Body wrapper -->
          <div class="modal-body-wrapper position-relative h-100 overflow-hidden d-flex flex-column">
            
            <div class="video-area">
              <iframe 
                ref="ytIframe"
                :src="ensureYTApi(selectedItem.embedUrl)" 
                allow="autoplay; encrypted-media; picture-in-picture" 
                allowfullscreen
                :title="selectedItem.videoTitle">
              </iframe>
            </div>

            <div class="cta-row">
              <button class="cta cta-primary" type="button" @click="expandSheet(true)">
                <i class="fa-solid fa-file-lines mr-2"></i> Leer Resumen
              </button>
              <button class="cta cta-secondary" type="button" @click="tryPlay">
                <i class="fa-solid fa-play mr-2"></i> Ver Video
              </button>
            </div>

            <!-- Bottom Sheet -->
            <div 
              class="sheet" 
              :class="{ expanded: isSheetExpanded }"
              :style="sheetStyle"
            >
              <div class="sheet-handle" @click="toggleSheet">
                <div class="grabber"></div>
                <div class="sheet-title">
                   <i class="fa-solid fa-book-open mr-2" style="color: var(--accent);"></i>
                   Resumen y Puntos Clave
                </div>
                <i class="fa-solid sheet-toggle-icon" :class="isSheetExpanded ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
              </div>

              <div class="sheet-scroller" ref="sheetScroller">
                <div class="md" :style="{ fontSize: currentFontSize + 'px' }" v-html="renderMarkdown(currentSummaryContent)"></div>
              </div>

              <!-- Footer Buttons Inside Sheet -->
              <div class="modal-footer border-0 p-4 d-flex justify-content-end bg-white">
                <button type="button" class="btn-ai-regenerate" @click="regenerateSummary(selectedItem.id)">
                  <i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Mejorar Resumen
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const { data: pageData, pending } = await useFetch('/api/page-data');

const USE_SYNTH_THUMBS = true;
const thumbCache = new Map();

const searchText = ref('');
const currentPage = ref(1);
const itemsPerPage = 6;
const currentItemIndex = ref(null);
const isSheetExpanded = ref(false);
const animationClass = ref('');
const ytIframe = ref(null);
const sheetScroller = ref(null);
const currentFontSize = ref(18); // Default to a readable 18px

useHead(() => {
  const latestItem = (pageData.value && pageData.value.length > 0) ? pageData.value[0] : null;
  return {
    title: latestItem ? latestItem.videoTitle : 'Programa de Formación Casita del Saber',
    meta: [
      { name: 'description', content: latestItem ? latestItem.summary : 'Programa de Formación' },
      { property: 'og:title', content: latestItem ? latestItem.videoTitle : 'Programa de Formación Casita del Saber' },
      { property: 'og:description', content: latestItem ? latestItem.summary : 'Programa de Formación' },
      { property: 'og:image', content: latestItem ? latestItem.thumbnailLink : '/img/IECS-FULL.png' },
    ]
  };
});

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

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / itemsPerPage)));

const visiblePages = computed(() => {
  const startP = Math.max(1, currentPage.value - 1);
  const endP = Math.min(totalPages.value, currentPage.value + 1);
  const pages = [];
  for (let p = startP; p <= endP; p++) pages.push(p);
  return pages;
});

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredData.value.slice(start, start + itemsPerPage);
});

watch(searchText, () => {
  currentPage.value = 1;
});

const selectedItem = computed(() => {
  if (currentItemIndex.value === null) return null;
  return filteredData.value[currentItemIndex.value];
});

const currentSummaryContent = computed(() => {
  if (!selectedItem.value) return '';
  const item = selectedItem.value;
  return (item.summary && item.summary.trim().length) ? item.summary : (item.transcriptionContent || '— No hay resumen disponible —');
});

const generateThumbCanvas = (title) => {
  if (import.meta.server) return ''; 
  
  const key = (title || 'Conferencia').trim() || 'Conferencia';
  if (thumbCache.has(key)) return thumbCache.get(key);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 640, H = 360;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Lighter, more vibrant, modern gradients for the Light Theme
  const palettes = [
    ['#4F46E5', '#3B82F6'], // Indigo to Blue
    ['#0ea5e9', '#0284c7'], // Sky Blue
    ['#10b981', '#059669'], // Emerald
    ['#8b5cf6', '#6d28d9'], // Violet
    ['#f59e0b', '#d97706'], // Amber
    ['#f43f5e', '#e11d48']  // Rose
  ];
  
  let h = 0; for(let i=0; i<key.length; i++){h=(h<<5)-h+key.charCodeAt(i);h|=0;}
  const pal = palettes[Math.abs(h) % palettes.length];

  const grd = ctx.createLinearGradient(0,0,W,H);
  grd.addColorStop(0, pal[0]); grd.addColorStop(1, pal[1]);
  ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);

  ctx.globalAlpha = 0.08; ctx.fillStyle = '#ffffff';
  for(let i=0; i<W; i+=40) { ctx.fillRect(i, 0, 1, H); }
  for(let i=0; i<H; i+=40) { ctx.fillRect(0, i, W, 1); }
  ctx.globalAlpha = 1;

  // Modern abstract shape
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; 
  ctx.beginPath(); ctx.arc(W - 40, H - 40, 100, 0, Math.PI*2); ctx.fill();

  const pad = 40, boxW = W - pad*2, maxLines = 3;
  let fontSize = 46;
  ctx.textBaseline = 'top';
  
  const wrapLines = (ctx, text, maxWidth, mxLines) => {
    const words = text.split(/\s+/); const lines=[]; let curr='';
    for (let i=0;i<words.length;i++){
      const test = curr ? curr+' '+words[i] : words[i];
      if (ctx.measureText(test).width <= maxWidth) curr = test;
      else { if (curr) lines.push(curr); curr = words[i]; if (lines.length === mxLines-1) break; }
    }
    if (curr && lines.length < mxLines) lines.push(curr);
    let truncated = (lines.join(' ') !== text);
    if (lines.length === mxLines){
      while (ctx.measureText(lines[lines.length-1] + '…').width > maxWidth && lines[lines.length-1].length) {
        lines[lines.length-1] = lines[lines.length-1].slice(0,-1);
      }
      lines[lines.length-1] += '…';
    }
    return {lines, truncated};
  };

  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  let wrapped = wrapLines(ctx, key, boxW, maxLines);
  while (wrapped.truncated && fontSize > 24) {
    fontSize -= 2;
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    wrapped = wrapLines(ctx, key, boxW, maxLines);
  }

  const textH = wrapped.lines.length * (fontSize * 1.25);
  const textY = (H - textH) / 2;
  ctx.shadowColor="rgba(0,0,0,0.15)"; ctx.shadowBlur=15; ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  wrapped.lines.forEach((ln, i) => ctx.fillText(ln, pad, textY + i*(fontSize*1.25)));
  ctx.shadowBlur=0; ctx.shadowOffsetY=0;

  const url = canvas.toDataURL('image/jpeg', 0.9);
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

const goToPage = (p) => {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p;
  }
};

const formatSummary = (s) => {
  s = s || '';
  return s.length > 120 ? s.slice(0, 120) + '…' : s;
};

const renderMarkdown = (text) => {
  if (!text) return '';
  const fixed = text.replace(/INSS/g, 'IMSS');
  marked.setOptions({ headerIds: false, mangle: false, breaks: true });
  const raw = marked.parse(fixed);
  if (import.meta.server) return raw; 
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
};

const openMediaModal = (index) => {
  if(index < 0 || index >= filteredData.value.length) return;
  currentItemIndex.value = index;
  isSheetExpanded.value = false;
  animationClass.value = 'slide-in-up';
  setTimeout(() => { animationClass.value = ''; }, 300);
};

const closeModal = () => {
  currentItemIndex.value = null;
  isSheetExpanded.value = false;
};

const increaseFontSize = () => {
  currentFontSize.value = Math.min(currentFontSize.value + 2, 28);
};

const toggleSheet = () => {
  isSheetExpanded.value = !isSheetExpanded.value;
};

const expandSheet = (focusTop = false) => {
  isSheetExpanded.value = true;
  if (focusTop && sheetScroller.value) {
    sheetScroller.value.scrollTop = 0;
  }
};

const sheetStyle = computed(() => {
  if (isSheetExpanded.value) return { transform: 'translateY(0%)' };
  return { transform: 'translateY(calc(100% - var(--sheet-peek)))' };
});

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

const tryPlay = () => {
  try {
    if (ytIframe.value) {
      ytIframe.value.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    }
  } catch (e) {}
};

// Touch/Swipe Logic
let touchStartX = 0, touchEndX = 0;
let isAnimating = false;

const onTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
const onTouchEnd = (e) => {
  touchEndX = e.changedTouches[0].screenX;
  if (Math.abs(touchEndX - touchStartX) > 50) {
    if (touchEndX < touchStartX) navigateNext('left'); else navigatePrev('right');
  }
};

const navigateNext = (dir = 'left') => {
  if (currentItemIndex.value == null || currentItemIndex.value >= filteredData.value.length - 1) return;
  animateSwap(currentItemIndex.value + 1, dir);
};
const navigatePrev = (dir = 'right') => {
  if (currentItemIndex.value == null || currentItemIndex.value <= 0) return;
  animateSwap(currentItemIndex.value - 1, dir);
};

const animateSwap = (newIndex, dir) => {
  if (isAnimating) return;
  isAnimating = true;
  
  animationClass.value = dir === 'left' ? 'fade-out' : 'fade-out';
  
  setTimeout(() => {
    currentItemIndex.value = newIndex;
    isSheetExpanded.value = false;
    animationClass.value = 'fade-in';
    
    setTimeout(() => {
      animationClass.value = '';
      isAnimating = false;
    }, 200);
  }, 200);
};

const regenerateSummary = async (videoId) => {
  if (!window.Swal) return;
  const res = await window.Swal.fire({
    title: 'Generar con IA',
    input: 'textarea',
    inputLabel: 'Instrucciones para la IA',
    inputValue: 'Resume los puntos clave detallados del video en una lista concisa.',
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
    text: 'La inteligencia artificial está trabajando.',
    allowOutsideClick: false, 
    customClass: { popup: 'swal-modern-popup' },
    didOpen: () => window.Swal.showLoading() 
  });

  try {
    const response = await $fetch('/regenerate-summary', {
      method: 'POST',
      body: { videoId, prompt: res.value }
    });
    
    const originalItem = pageData.value.find(d => d.id === videoId);
    if (originalItem) originalItem.summary = response.summary;
    
    window.Swal.fire({ icon: 'success', title: '¡Resumen Mejorado!', text: 'El contenido se ha actualizado.', timer: 1500, showConfirmButton: false, customClass: { popup: 'swal-modern-popup' } });
  } catch (error) {
    window.Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el resumen.', customClass: { popup: 'swal-modern-popup' } });
  }
};
</script>

<style>
/* Modern UX/UI Redesign: Light, Accessible, Elegant */
:root {
  --bg-body: #F8FAFC;         /* Light grayish blue background */
  --bg-surface: #FFFFFF;      /* Pure white cards */
  --text-main: #0F172A;       /* Slate 900 for high contrast text */
  --text-muted: #64748B;      /* Slate 500 for secondary text */
  
  --accent: #4F46E5;          /* Indigo 600 - Primary Brand Color */
  --accent-hover: #4338CA;    /* Indigo 700 */
  --accent-glow: rgba(79, 70, 229, 0.15);
  
  --border-subtle: 1px solid #E2E8F0; /* Slate 200 */
  
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --shadow-float: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  
  --sheet-peek: 90px;
  --sheet-expanded: 75vh;
  
  --font-stack: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
}

html, body {
  height: 100%;
  background-color: var(--bg-body);
  font-family: var(--font-stack);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5 { letter-spacing: -0.03em; font-weight: 800; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.container-fluid { max-width: 1280px; padding-left: clamp(16px, 5vw, 40px); padding-right: clamp(16px, 5vw, 40px); }

/* Header */
.brand-header { padding: 60px 0 40px; }
.brand-logo { height: 80px; margin-bottom: 24px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1)); }
.brand-header h1 {
  font-size: clamp(28px, 5vw, 48px);
  color: var(--text-main);
  margin-bottom: 12px;
}
.brand-header .subtitle {
  font-size: 1.15rem;
  color: var(--text-muted);
  max-width: 600px;
  margin: 0 auto;
}

/* Glass Search */
.search-wrap {
  position: sticky; top: 0; z-index: 100; padding: 20px 0;
  background: rgba(248, 250, 252, 0.85); /* Matches var(--bg-body) with opacity */
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
}
.search-input {
  background: var(--bg-surface);
  border: 1px solid #CBD5E1;
  color: var(--text-main);
  border-radius: 99px; padding: 18px 24px 18px 56px; font-size: 1.1rem; font-weight: 500;
  box-shadow: var(--shadow-sm); transition: all 0.3s ease;
}
.search-input:focus {
  background: var(--bg-surface); border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-glow);
  color: var(--text-main); outline: none;
}
.search-input::placeholder { color: #94A3B8; font-weight: 400; }
.search-icon {
  position: absolute; left: 24px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); font-size: 1.25rem; pointer-events: none;
}

/* Video Cards */
.video-card {
  background: var(--bg-surface);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden; cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  display: flex; flex-direction: column;
}
.video-card:hover { 
  transform: translateY(-6px); 
  box-shadow: var(--shadow-xl); 
  border-color: #CBD5E1;
}
.video-card:active { transform: scale(0.98); }

.video-thumb { width: 100%; aspect-ratio: 16/9; background: #E2E8F0; position: relative; overflow: hidden; }
.video-thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s ease; }
.video-card:hover .video-thumb img { transform: scale(1.05); }

.play-badge {
  position: absolute; right: 16px; bottom: 16px;
  background: var(--bg-surface); color: var(--accent);
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-lg); font-size: 1.1rem;
  transition: transform 0.2s, background 0.2s, color 0.2s;
}
.video-card:hover .play-badge {
  background: var(--accent); color: white; transform: scale(1.1);
}

.card-body-custom { padding: 24px; flex: 1; display: flex; flex-direction: column; }
.video-title { font-weight: 700; font-size: 1.25rem; line-height: 1.4; color: var(--text-main); margin-bottom: 10px; }
.video-summary { font-size: 1rem; color: var(--text-muted); line-height: 1.6; }

/* Empty State */
.empty-icon {
  width: 96px; height: 96px; background: #E2E8F0; color: #94A3B8;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem; margin: 0 auto;
}

/* Pagination */
.pagination { gap: 8px; }
.pagination .page-item .page-link {
  background: var(--bg-surface); border: var(--border-subtle); color: var(--text-main);
  border-radius: 12px !important; font-weight: 600; padding: 10px 18px; font-size: 1rem;
  box-shadow: var(--shadow-sm); transition: all 0.2s;
}
.pagination .page-item .page-link:hover {
  background: #F1F5F9; border-color: #CBD5E1;
}
.pagination .page-item.active .page-link { 
  background: var(--accent); color: #FFF; border-color: var(--accent); box-shadow: var(--shadow-md); 
}
.pagination .page-item.disabled .page-link { background: #F8FAFC; color: #CBD5E1; box-shadow: none; cursor: not-allowed; }

/* Modal Design */
.modal-content { 
  background: var(--bg-surface); border-radius: var(--radius-lg); 
  height: 100vh; border: none; overflow: hidden; 
  box-shadow: var(--shadow-float);
}
.modal-header { 
  background: var(--bg-surface); border-bottom: var(--border-subtle); 
  padding: 20px 24px; z-index: 10; display: flex; align-items: center; justify-content: space-between;
}
.modal-title { font-weight: 800; font-size: 1.35rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
.modal-actions { display: flex; gap: 12px; align-items: center; }

.a11y-btn, .close-btn { 
  background: #F1F5F9; border: none; color: var(--text-main); 
  width: 44px; height: 44px; border-radius: 50%; font-size: 1.1rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; cursor: pointer;
}
.a11y-btn:hover, .close-btn:hover { background: #E2E8F0; }
.close-btn:hover { background: #FEE2E2; color: #DC2626; }

.modal-body-wrapper { background: var(--bg-body); }
.video-area { background: #000; width: 100%; aspect-ratio: 16/9; }
.video-area iframe { width: 100%; height: 100%; display: block; border: none; }

.cta-row { padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: var(--bg-body); }
.cta { 
  border: none; border-radius: 12px; padding: 16px; font-weight: 700; font-size: 1rem; 
  display: flex; align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer;
}
.cta:active { transform: scale(0.97); }
.cta-primary { background: var(--accent); color: #FFF; box-shadow: var(--shadow-md); }
.cta-primary:hover { background: var(--accent-hover); }
.cta-secondary { background: #FFFFFF; border: 1px solid #CBD5E1; color: var(--text-main); box-shadow: var(--shadow-sm); }
.cta-secondary:hover { background: #F8FAFC; border-color: #94A3B8; }

/* Bottom Sheet */
.sheet { 
  background: var(--bg-surface); border-top: var(--border-subtle); 
  border-top-left-radius: var(--radius-lg); border-top-right-radius: var(--radius-lg); 
  box-shadow: 0 -10px 40px rgba(0,0,0,0.08); position: absolute; left: 0; right: 0; bottom: 0; 
  height: var(--sheet-expanded); transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); 
  z-index: 3; display: flex; flex-direction: column; 
}
.sheet-handle { 
  padding: 16px 24px; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #F1F5F9; background: var(--bg-surface); border-top-left-radius: var(--radius-lg); border-top-right-radius: var(--radius-lg);
  position: relative;
}
.grabber {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  width: 40px; height: 5px; background: #CBD5E1; border-radius: 10px;
}
.sheet-title { font-size: 1.15rem; color: var(--text-main); font-weight: 700; margin-top: 8px; }
.sheet-toggle-icon { color: #94A3B8; font-size: 1.2rem; margin-top: 8px; transition: transform 0.3s; }
.sheet-scroller { padding: 32px; overflow-y: auto; flex: 1; background: #FFFFFF; }

.btn-ai-regenerate {
  background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A;
  border-radius: 99px; padding: 10px 20px; font-weight: 600; font-size: 0.95rem;
  transition: all 0.2s; cursor: pointer;
}
.btn-ai-regenerate:hover { background: #FEF3C7; border-color: #FCD34D; }

/* Typography Formatting inside Sheet */
.md { line-height: 1.8; color: #334155; transition: font-size 0.2s; }
.md h1, .md h2, .md h3 { color: #0F172A; margin-top: 1.5em; margin-bottom: 0.75em; font-weight: 800; }
.md p { margin-bottom: 1.25em; }
.md strong { color: var(--accent); font-weight: 700; }
.md blockquote { border-left: 4px solid var(--accent); background: #F8FAFC; padding: 16px 20px; border-radius: 0 12px 12px 0; font-style: italic; color: #475569; margin: 1.5em 0; }
.md ul { padding-left: 24px; margin-bottom: 1.5em; }
.md ul li { margin-bottom: 0.75em; }
.md ul li::marker { color: var(--accent); }

/* Navigation Swipers */
.swipe-indicator { position: absolute; top: 40%; left: 0; right: 0; transform: translateY(-50%); display: flex; justify-content: space-between; padding: 0 20px; pointer-events: none; z-index: 20; }
.swipe-indicator .arrow { 
  background: var(--bg-surface); border: var(--border-subtle); box-shadow: var(--shadow-lg);
  width: 56px; height: 56px; font-size: 1.2rem; pointer-events: auto; border-radius: 50%; 
  display: flex; align-items: center; justify-content: center; color: var(--text-main); 
  transition: all 0.2s;
}
.swipe-indicator .arrow:hover { transform: scale(1.1); color: var(--accent); }

.page-pill { 
  position: absolute; bottom: calc(var(--sheet-peek) + 24px); left: 50%; transform: translateX(-50%); 
  background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(10px); color: white; 
  border-radius: 99px; padding: 8px 20px; z-index: 10; font-weight: 600; font-variant-numeric: tabular-nums; 
  box-shadow: var(--shadow-md);
}

/* SweetAlert overrides for modern look */
.swal-modern-popup { border-radius: 20px !important; padding: 30px !important; box-shadow: var(--shadow-float) !important; }
.swal-modern-title { font-family: var(--font-stack) !important; font-weight: 800 !important; color: var(--text-main) !important; }
.swal-modern-input { border-radius: 12px !important; font-family: var(--font-stack) !important; }

/* Animations */
.slide-in-up { animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.fade-in { animation: fadeIn 0.2s forwards; }
.fade-out { animation: fadeOut 0.2s forwards; }

@keyframes slideInUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

/* Desktop Optimizations */
@media (min-width: 992px) {
  .modal-dialog { max-width: 1100px; height: 85vh; margin: 7.5vh auto; }
  .modal-content { border-radius: var(--radius-lg); height: 100%; border: var(--border-subtle); overflow: hidden; display: flex; flex-direction: column; }
  .modal-body-wrapper { flex-direction: row; align-items: stretch; }
  
  .video-area { flex: 1.5; border-radius: 0; margin: 0; border-right: var(--border-subtle); display: flex; align-items: center; background: #000; }
  .video-area iframe { max-height: 100%; }

  .sheet { 
    position: static; height: auto; transform: none !important; margin: 0; flex: 1;
    border-radius: 0; border: none; box-shadow: none; display: flex; flex-direction: column;
  }
  .sheet-handle { display: none; }
  .sheet-scroller { padding: 32px 40px; }
  
  .cta-row { display: none; /* Hide redundant buttons on desktop split-view */ }
  .page-pill { bottom: 32px; left: 32px; transform: none; }
  
  .swipe-indicator { width: calc(100% + 140px); left: -70px; padding: 0; }
}

#loader { 
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
  background: rgba(248, 250, 252, 0.9); backdrop-filter: blur(8px);
  z-index: 9999; display: flex; align-items: center; justify-content: center; flex-direction: column; 
}
</style>