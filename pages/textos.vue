<template>
  <div class="text-export-page">
    <header class="text-export-header">
      <div class="header-inner">
        <div class="header-left">
          <NuxtLink to="/" class="icon-btn" aria-label="Volver">
            <i class="fa-solid fa-arrow-left"></i>
          </NuxtLink>
          <div>
            <h1>Textos para copiar</h1>
            <p>Selecciona conferencias y une resúmenes o transcripciones en texto plano.</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="action-btn secondary" @click="clearSelection" :disabled="selectedIds.length === 0">
            Limpiar
          </button>
          <button class="action-btn primary" @click="copyToClipboard" :disabled="!compiledText.trim()">
            <i class="fa-solid fa-copy mr-2"></i> Copiar
          </button>
        </div>
      </div>
    </header>

    <main class="text-export-main">
      <section class="controls-card">
        <div class="mode-tabs" role="tablist" aria-label="Tipo de texto">
          <button
            class="mode-tab"
            :class="{ active: mode === 'summary' }"
            role="tab"
            :aria-selected="mode === 'summary'"
            @click="mode = 'summary'"
          >
            <i class="fa-solid fa-align-left"></i>
            Resúmenes
          </button>
          <button
            class="mode-tab"
            :class="{ active: mode === 'transcript' }"
            role="tab"
            :aria-selected="mode === 'transcript'"
            @click="mode = 'transcript'"
          >
            <i class="fa-solid fa-file-lines"></i>
            Transcripciones
          </button>
        </div>

        <div class="toolbar-row">
          <div class="search-wrap">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              v-model="searchText"
              class="search-input"
              type="search"
              placeholder="Buscar por título o ID…"
              autocomplete="off"
            />
          </div>
          <label class="title-toggle">
            <input type="checkbox" v-model="includeTitles" />
            Incluir títulos
          </label>
        </div>

        <div class="selection-actions">
          <button class="mini-btn" @click="selectVisible" :disabled="visibleItems.length === 0">
            Seleccionar visibles
          </button>
          <button class="mini-btn" @click="selectReadyVisible" :disabled="readyVisibleItems.length === 0">
            Seleccionar con {{ modeLabel }}
          </button>
          <span class="selection-meta">
            {{ selectedIds.length }} seleccionada{{ selectedIds.length === 1 ? '' : 's' }} · {{ compiledText.length.toLocaleString('es-MX') }} caracteres
          </span>
        </div>
      </section>

      <section class="workspace-grid">
        <aside class="meeting-panel">
          <div v-if="pending" class="loader-box">
            <div class="spinner-border" style="width: 2rem; height: 2rem; color: var(--accent);" role="status"></div>
            <span>Cargando conferencias…</span>
          </div>

          <div v-else-if="visibleItems.length === 0" class="empty-state">
            <i class="fa-regular fa-folder-open"></i>
            <p>No hay resultados para esta búsqueda.</p>
          </div>

          <template v-else>
            <label
              v-for="item in visibleItems"
              :key="item.id"
              class="meeting-option"
              :class="{ selected: selectedIdSet.has(item.id), unavailable: !isReadyForMode(item) }"
            >
              <input type="checkbox" :value="item.id" v-model="selectedIds" />
              <div class="meeting-copy">
                <div class="meeting-title">#{{ item.id }} · {{ item.videoTitle }}</div>
                <div class="meeting-badges">
                  <span class="status-badge" :class="{ ready: item.hasSummary }">Resumen</span>
                  <span class="status-badge" :class="{ ready: item.hasTranscript }">Transcripción</span>
                </div>
                <p v-if="item.summaryPreview" class="meeting-preview">{{ item.summaryPreview }}</p>
              </div>
            </label>
          </template>
        </aside>

        <section class="preview-panel">
          <div class="preview-header">
            <div>
              <h2>{{ mode === 'summary' ? 'Resúmenes unidos' : 'Transcripciones unidas' }}</h2>
              <p v-if="bundleLoading">Recuperando texto desde {{ mode === 'summary' ? 'MySQL' : 'Google Drive' }}…</p>
              <p v-else>{{ bundleMeta }}</p>
            </div>
            <button class="action-btn primary" @click="copyToClipboard" :disabled="!compiledText.trim()">
              Copiar texto plano
            </button>
          </div>

          <textarea
            class="plain-text-output"
            :value="compiledText"
            readonly
            spellcheck="false"
            :placeholder="outputPlaceholder"
          ></textarea>

          <div v-if="bundleError" class="error-box">
            {{ bundleError }}
          </div>
        </section>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useFetch, useHead } from '#imports';

useHead({
  title: 'Textos para copiar | Casita del Saber'
});

const { data: items, pending } = await useFetch('/api/plain-text-items');

const mode = ref('summary');
const searchText = ref('');
const includeTitles = ref(true);
const selectedIds = ref([]);
const compiledText = ref('');
const bundleItems = ref([]);
const bundleLoading = ref(false);
const bundleError = ref('');
let bundleTimer = null;
let bundleRequestId = 0;

const modeLabel = computed(() => mode.value === 'summary' ? 'resumen' : 'transcripción');

const selectedIdSet = computed(() => new Set(selectedIds.value));

const visibleItems = computed(() => {
  const query = searchText.value.toLowerCase().trim();
  const source = items.value || [];
  if (!query) return source;
  return source.filter((item) => {
    const haystack = `#${item.id} ${item.videoTitle || ''}`.toLowerCase();
    return haystack.includes(query);
  });
});

const readyVisibleItems = computed(() => visibleItems.value.filter(isReadyForMode));

const bundleMeta = computed(() => {
  if (!selectedIds.value.length) return 'Selecciona conferencias para generar el texto unido.';
  if (!compiledText.value.trim()) return 'No hay texto disponible para la selección actual.';
  return `${bundleItems.value.length} bloque${bundleItems.value.length === 1 ? '' : 's'} listo${bundleItems.value.length === 1 ? '' : 's'} para copiar.`;
});

const outputPlaceholder = computed(() => {
  return mode.value === 'summary'
    ? 'Selecciona una o más conferencias para ver aquí los resúmenes unidos en texto plano.'
    : 'Selecciona una o más conferencias para ver aquí las transcripciones unidas en texto plano.';
});

function isReadyForMode(item) {
  return mode.value === 'summary' ? item.hasSummary : item.hasTranscript;
}

function selectVisible() {
  selectedIds.value = visibleItems.value.map((item) => item.id);
}

function selectReadyVisible() {
  selectedIds.value = readyVisibleItems.value.map((item) => item.id);
}

function clearSelection() {
  selectedIds.value = [];
}

async function loadBundle() {
  const ids = selectedIds.value.slice();
  const requestId = ++bundleRequestId;
  bundleError.value = '';

  if (!ids.length) {
    compiledText.value = '';
    bundleItems.value = [];
    return;
  }

  bundleLoading.value = true;
  try {
    const response = await $fetch('/api/plain-text-bundle', {
      method: 'POST',
      body: {
        ids,
        mode: mode.value,
        includeTitles: includeTitles.value,
      },
    });

    if (requestId !== bundleRequestId) return;
    compiledText.value = response.text || '';
    bundleItems.value = response.items || [];
  } catch (error) {
    if (requestId !== bundleRequestId) return;
    compiledText.value = '';
    bundleItems.value = [];
    bundleError.value = 'No se pudo recuperar el texto. Revisa que las variables GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY_BASE64 del .env tengan acceso a los archivos de Drive.';
    console.error(error);
  } finally {
    if (requestId === bundleRequestId) bundleLoading.value = false;
  }
}

watch([selectedIds, mode, includeTitles], () => {
  if (bundleTimer) clearTimeout(bundleTimer);
  bundleTimer = setTimeout(loadBundle, 300);
}, { deep: true });

async function copyToClipboard() {
  if (!compiledText.value.trim()) return;
  try {
    await navigator.clipboard.writeText(compiledText.value);
    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'Copiado',
        text: 'El texto plano está en el portapapeles.',
        timer: 1600,
        showConfirmButton: false,
        customClass: { popup: 'swal-modern-popup' }
      });
    }
  } catch (error) {
    if (window.Swal) {
      window.Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo copiar el texto.' });
    }
  }
}
</script>

<style scoped>
.text-export-page {
  min-height: 100vh;
  background: #F1F5F9;
  color: var(--text-main, #0F172A);
  font-family: var(--font-stack, 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif);
}

.text-export-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color, #E2E8F0);
}

.header-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-left,
.header-actions,
.toolbar-row,
.selection-actions,
.mode-tabs,
.preview-header,
.meeting-badges {
  display: flex;
  align-items: center;
}

.header-left { gap: 16px; }
.header-actions { gap: 10px; flex-wrap: wrap; }

.header-left h1,
.preview-header h2 {
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.header-left h1 { font-size: 1.35rem; }
.preview-header h2 { font-size: 1.15rem; }

.header-left p,
.preview-header p {
  margin: 4px 0 0;
  color: var(--text-muted, #64748B);
  font-size: 0.9rem;
}

.icon-btn,
.action-btn,
.mini-btn,
.mode-tab {
  border: 1px solid var(--border-color, #E2E8F0);
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: white;
  color: var(--text-muted, #64748B);
  text-decoration: none;
}

.action-btn {
  min-height: 40px;
  border-radius: 10px;
  padding: 0 16px;
  font-weight: 800;
  background: white;
}

.action-btn.primary {
  border-color: var(--accent, #4F46E5);
  background: var(--accent, #4F46E5);
  color: white;
}

.action-btn.secondary {
  color: var(--text-muted, #64748B);
}

.action-btn:disabled,
.mini-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.text-export-main {
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px 24px 56px;
}

.controls-card {
  background: white;
  border: 1px solid var(--border-color, #E2E8F0);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
  margin-bottom: 20px;
}

.mode-tabs {
  gap: 8px;
  padding: 4px;
  background: #F8FAFC;
  border-radius: 14px;
  margin-bottom: 16px;
}

.mode-tab {
  flex: 1;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  padding: 12px 14px;
  background: transparent;
  color: var(--text-muted, #64748B);
  font-weight: 800;
}

.mode-tab.active {
  background: white;
  color: var(--accent, #4F46E5);
  border-color: var(--accent-light, #EEF2FF);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
}

.toolbar-row {
  gap: 12px;
  flex-wrap: wrap;
}

.search-wrap {
  flex: 1;
  min-width: 260px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-light, #94A3B8);
}

.search-input {
  width: 100%;
  border: 1px solid var(--border-color, #E2E8F0);
  border-radius: 10px;
  padding: 12px 14px 12px 40px;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent, #4F46E5);
  box-shadow: 0 0 0 3px var(--accent-light, #EEF2FF);
}

.title-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text-muted, #64748B);
  font-weight: 700;
}

.selection-actions {
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.mini-btn {
  border-radius: 999px;
  padding: 8px 12px;
  background: #F8FAFC;
  color: var(--text-main, #0F172A);
  font-weight: 800;
}

.selection-meta {
  color: var(--text-muted, #64748B);
  font-size: 0.9rem;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(320px, 430px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.meeting-panel,
.preview-panel {
  background: white;
  border: 1px solid var(--border-color, #E2E8F0);
  border-radius: 18px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
}

.meeting-panel {
  max-height: calc(100vh - 235px);
  overflow: auto;
  padding: 10px;
}

.loader-box,
.empty-state {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted, #64748B);
  text-align: center;
}

.empty-state i { font-size: 2rem; color: var(--text-light, #94A3B8); }

.meeting-option {
  display: flex;
  gap: 12px;
  padding: 13px;
  border-radius: 14px;
  border: 1px solid transparent;
  cursor: pointer;
  margin: 0 0 8px;
  transition: all 0.2s ease;
}

.meeting-option:hover { background: #F8FAFC; }
.meeting-option.selected { background: var(--accent-light, #EEF2FF); border-color: rgba(79, 70, 229, 0.35); }
.meeting-option.unavailable { opacity: 0.66; }

.meeting-option input {
  margin-top: 4px;
  width: 18px;
  height: 18px;
  accent-color: var(--accent, #4F46E5);
}

.meeting-copy { min-width: 0; }
.meeting-title { font-weight: 800; font-size: 0.95rem; color: var(--text-main, #0F172A); }
.meeting-badges { gap: 6px; margin-top: 7px; flex-wrap: wrap; }

.status-badge {
  border-radius: 999px;
  padding: 4px 8px;
  background: #F1F5F9;
  color: var(--text-light, #94A3B8);
  font-size: 0.75rem;
  font-weight: 800;
}

.status-badge.ready {
  background: #ECFDF5;
  color: #047857;
}

.meeting-preview {
  margin: 8px 0 0;
  color: var(--text-muted, #64748B);
  font-size: 0.82rem;
  line-height: 1.45;
}

.preview-panel {
  min-height: calc(100vh - 235px);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview-header {
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.plain-text-output {
  flex: 1;
  min-height: 540px;
  width: 100%;
  resize: vertical;
  border: 1px solid var(--border-color, #E2E8F0);
  border-radius: 14px;
  padding: 18px;
  background: #F8FAFC;
  color: #111827;
  line-height: 1.65;
  font: 0.95rem/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  white-space: pre-wrap;
  outline: none;
}

.plain-text-output:focus {
  border-color: var(--accent, #4F46E5);
  box-shadow: 0 0 0 3px var(--accent-light, #EEF2FF);
}

.error-box {
  border-radius: 12px;
  padding: 12px 14px;
  background: #FEF2F2;
  color: #991B1B;
  font-weight: 700;
}

@media (max-width: 920px) {
  .header-inner,
  .toolbar-row,
  .preview-header {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions { width: 100%; }
  .action-btn { flex: 1; }

  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .meeting-panel {
    max-height: 420px;
  }

  .preview-panel {
    min-height: auto;
  }

  .plain-text-output {
    min-height: 420px;
  }
}
</style>
