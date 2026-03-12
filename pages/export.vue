<template>
  <div class="export-page">
    
    <!-- Sticky Header -->
    <header class="export-header">
      <div class="header-inner">
        <div class="header-left">
          <NuxtLink to="/" class="icon-btn" aria-label="Volver">
            <i class="fa-solid fa-arrow-left"></i>
          </NuxtLink>
          <div class="header-title">
            <h1>Compilación de Resúmenes</h1>
          </div>
        </div>
        
        <div class="header-actions">
          <button class="action-btn copy-btn" @click="copyToClipboard" :disabled="filteredAndSortedData.length === 0">
            <i class="fa-solid fa-copy mr-2"></i> Copiar Texto
          </button>
        </div>
      </div>
    </header>

    <!-- Content Area -->
    <main class="export-main">
      <div class="controls-card">
        <p class="controls-desc">Selecciona el periodo que deseas exportar. Se generará un documento unificado con todos los resúmenes ordenados cronológicamente.</p>
        
        <div class="date-picker-row">
          <div class="input-group">
            <label for="startDate">Desde:</label>
            <input type="date" id="startDate" v-model="startDate" class="date-input" />
          </div>
          
          <div class="input-group">
            <label for="endDate">Hasta:</label>
            <input type="date" id="endDate" v-model="endDate" class="date-input" />
          </div>
        </div>
        
        <div class="results-meta" v-if="!pending">
          <span class="badge-tag">
            Se encontraron <strong>{{ filteredAndSortedData.length }}</strong> resúmenes en este periodo
          </span>
        </div>
      </div>

      <div v-if="pending" class="loader-container">
        <div class="spinner-border" style="width: 2rem; height: 2rem; color: var(--accent);" role="status"></div>
        <p class="mt-2 text-muted">Generando compilación...</p>
      </div>

      <!-- Compiled Reading View -->
      <div v-else class="paper-container">
        <div v-if="filteredAndSortedData.length === 0" class="empty-state">
          <i class="fa-regular fa-calendar-xmark"></i>
          <p>No hay conferencias en el rango de fechas seleccionado.</p>
        </div>

        <div v-else class="compiled-document">
          <div v-for="(item, index) in filteredAndSortedData" :key="item.id" class="compiled-item">
            <div class="compiled-meta">
               🗓️ {{ formatDate(item.createdTime) }}
            </div>
            <h2 class="compiled-title">{{ item.videoTitle || 'Sin título' }}</h2>
            <div 
              class="md-content" 
              v-html="renderMarkdown(item.summary || item.transcriptionContent || '— Sin resumen —')"
            ></div>
            
            <!-- Separator between items except the last one -->
            <hr v-if="index !== filteredAndSortedData.length - 1" class="item-separator" />
          </div>
        </div>
      </div>
    </main>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useFetch, useHead } from '#imports';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

useHead({
  title: 'Compilación de Resúmenes | Casita del Saber'
});

const { data: pageData, pending } = await useFetch('/api/page-data');

const startDate = ref('');
const endDate = ref('');

onMounted(() => {
  // Default Range: First day of current month to today
  const today = new Date();
  endDate.value = today.toISOString().split('T')[0];
  
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  startDate.value = firstDay.toISOString().split('T')[0];
});

// Filters data by date and sorts chronologically (oldest to newest)
const filteredAndSortedData = computed(() => {
  let filtered = pageData.value || [];
  
  if (startDate.value) {
    const start = new Date(startDate.value);
    start.setHours(0, 0, 0, 0);
    filtered = filtered.filter(item => new Date(item.createdTime).getTime() >= start.getTime());
  }
  if (endDate.value) {
    const end = new Date(endDate.value);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter(item => new Date(item.createdTime).getTime() <= end.getTime());
  }
  
  // Sort chronologically
  return filtered.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
});

// Used for copying a clean plain-text version to clipboard
const rawTextCompilation = computed(() => {
  return filteredAndSortedData.value.map(item => {
    const dStr = formatDate(item.createdTime);
    const title = item.videoTitle || 'Sin título';
    const content = item.summary || item.transcriptionContent || 'Sin resumen';
    return `📅 ${title}\n🗓️ Fecha: ${dStr}\n\n${content}`;
  }).join('\n\n' + '='.repeat(50) + '\n\n');
});

const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
};

const renderMarkdown = (text) => {
  if (!text) return '';
  const fixed = text.replace(/INSS/g, 'IMSS');
  marked.setOptions({ headerIds: false, mangle: false, breaks: true });
  const raw = marked.parse(fixed);
  if (import.meta.server) return raw; 
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
};

const copyToClipboard = () => {
  if (filteredAndSortedData.value.length === 0) return;
  
  navigator.clipboard.writeText(rawTextCompilation.value).then(() => {
    if (window.Swal) {
      window.Swal.fire({ 
        icon: 'success', 
        title: '¡Copiado!', 
        text: 'Los resúmenes se han copiado al portapapeles.', 
        timer: 2000, 
        showConfirmButton: false,
        customClass: { popup: 'swal-modern-popup' }
      });
    }
  }).catch(err => {
    console.error('Error copying text: ', err);
    if (window.Swal) {
      window.Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo copiar el texto.' });
    }
  });
};
</script>

<style scoped>
/* Scoped styles specific to the Export Page */
.export-page {
  min-height: 100vh;
  background-color: #F1F5F9;
  font-family: var(--font-stack);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
}

.export-header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title h1 {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-main);
}

.icon-btn {
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}
.icon-btn:hover {
  background: #E2E8F0;
  color: var(--text-main);
}

.action-btn {
  border-radius: 8px;
  height: 40px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.copy-btn {
  background: var(--accent);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
}
.copy-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
}
.copy-btn:disabled {
  background: #CBD5E1;
  cursor: not-allowed;
  box-shadow: none;
}

.export-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 80px;
  width: 100%;
}

.controls-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  margin-bottom: 32px;
}

.controls-desc {
  color: var(--text-muted);
  margin-top: 0;
  margin-bottom: 24px;
  font-size: 1rem;
  line-height: 1.5;
}

.date-picker-row {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.input-group {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.input-group label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-main);
}
.date-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #CBD5E1;
  font-family: inherit;
  font-size: 1rem;
  color: var(--text-main);
  background: #F8FAFC;
  outline: none;
  transition: all 0.2s;
}
.date-input:focus {
  border-color: var(--accent);
  background: white;
  box-shadow: 0 0 0 3px var(--accent-light);
}

.results-meta {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--accent-light);
  color: var(--accent-hover);
  border-radius: 99px;
  font-size: 0.9rem;
}
.badge-tag strong {
  margin: 0 4px;
  font-weight: 800;
}

.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
}

.paper-container {
  background: white;
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}
.empty-state i {
  font-size: 3rem;
  margin-bottom: 16px;
  color: #CBD5E1;
}

.compiled-document {
  padding: 40px;
}

.compiled-item {
  margin-bottom: 40px;
}

.compiled-meta {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.compiled-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  margin-top: 0;
  margin-bottom: 20px;
  line-height: 1.3;
}

.item-separator {
  border: none;
  border-top: 2px dashed #E2E8F0;
  margin-top: 40px;
  margin-bottom: 0;
}

/* Specific Markdown Scoping to ensure perfect legibility inside the document */
.md-content { line-height: 1.8; color: #334155; font-size: 1.05rem; }
.md-content h1, .md-content h2, .md-content h3 { color: #0F172A; margin-top: 1.8em; margin-bottom: 0.8em; font-weight: 800; }
.md-content p { margin-bottom: 1.5em; }
.md-content strong { color: var(--accent); font-weight: 700; }
.md-content blockquote {
  border-left: 4px solid var(--accent); background: #F8FAFC;
  padding: 16px 24px; border-radius: 0 12px 12px 0; font-style: italic; color: #475569; margin: 2em 0;
}
.md-content ul { padding-left: 24px; margin-bottom: 1.5em; }
.md-content ul li { margin-bottom: 0.75em; }
.md-content ul li::marker { color: var(--accent); }

@media (max-width: 768px) {
  .compiled-document {
    padding: 24px;
  }
  .header-inner {
    padding: 12px 16px;
  }
  .export-main {
    padding: 20px 16px 60px;
  }
}
</style>