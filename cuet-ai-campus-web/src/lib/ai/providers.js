// AI provider configuration — port of ai_provider_service.dart.
//
// Multiple AI providers can be saved on this device; one is active. Priority
// of pathways: active provider (any OpenAI-compatible endpoint) > personal
// Gemini key > campus server.
//
// Legacy note: before multi-provider support the app stored a single custom
// provider under KEYS.customProvider — it is migrated into the list on first
// read.
import { KEYS, readJson, readString, removeRaw, writeJson, writeString } from '../storage.js';
import { geminiKey } from './geminiKey.js';

export const AiActiveMode = { custom: 'custom', gemini: 'gemini', server: 'server' };

export const AiPresets = {
  geminiModels: [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ],

  /** OpenAI-compatible endpoints users commonly bring. */
  customBases: {
    'https://openrouter.ai/api/v1': [
      'openrouter/auto',
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3.5-haiku',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
    ],
    'https://api.openai.com/v1': ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    'https://api.groq.com/openai/v1': ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    'https://api.together.xyz/v1': [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ],
    'https://api.mistral.ai/v1': ['mistral-small-latest', 'mistral-large-latest'],
    'http://localhost:11434/v1': ['llama3.1:8b', 'qwen2.5:7b', 'mistral:7b'],
    'http://localhost:1234/v1': ['local-model'],
  },

  labelForBase(base) {
    const b = String(base ?? '').trim();
    if (b.startsWith('https://openrouter.ai')) return 'OpenRouter';
    if (b.startsWith('https://api.openai.com')) return 'OpenAI';
    if (b.startsWith('https://api.groq.com')) return 'Groq';
    if (b.startsWith('https://api.together.xyz')) return 'Together AI';
    if (b.startsWith('https://api.mistral.ai')) return 'Mistral';
    if (b.includes('localhost:11434') || b.includes('127.0.0.1:11434')) return 'Ollama (local)';
    if (b.includes('localhost:1234') || b.includes('127.0.0.1:1234')) return 'LM Studio (local)';
    if (b.includes('openzen')) return 'OpenZen';
    if (b.includes('agentrouter')) return 'AgentRouter';
    return 'Custom endpoint';
  },
};

export const defaultGeminiModel = 'gemini-2.0-flash';

function normalizeBase(url) {
  const trimmed = String(url ?? '').trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function newId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Stored provider shape: { id, label, baseUrl, apiKey, modelId } */
function sanitizeProvider(json, { keepKey } = {}) {
  if (!json || typeof json !== 'object') return null;
  const provider = {
    id: String(json.id ?? '').trim() || newId(),
    label: String(json.label ?? '').trim(),
    baseUrl: String(json.baseUrl ?? '').trim(),
    apiKey: String(json.apiKey ?? '').trim(),
    modelId: String(json.modelId ?? '').trim(),
  };
  if (!provider.baseUrl) return null;
  // Editors may omit the key to keep the stored one.
  if (!provider.apiKey && keepKey && json.id) return null;
  provider.normalizedBaseUrl = normalizeBase(provider.baseUrl);
  provider.label =
    provider.label || AiPresets.labelForBase(provider.baseUrl);
  return provider;
}

/** One-time migration of the legacy single-provider slot into the list. */
function migrateLegacyProvider(list) {
  const legacy = readJson(KEYS.customProvider, null);
  if (legacy && typeof legacy === 'object') {
    const imported = sanitizeProvider({
      id: newId(),
      label: AiPresets.labelForBase(legacy.baseUrl),
      baseUrl: legacy.baseUrl,
      apiKey: legacy.apiKey,
      modelId: legacy.modelId,
    });
    if (imported && !list.some((p) => p.normalizedBaseUrl === imported.normalizedBaseUrl)) {
      list.push(imported);
      writeJson(KEYS.aiProviders, list);
    }
    removeRaw(KEYS.customProvider);
  }
  return list;
}

export const aiProvider = {
  // --- Multi-provider store -------------------------------------------------
  /** All saved providers (active first not guaranteed — storage order). */
  listProviders() {
    let list = readJson(KEYS.aiProviders, []);
    if (!Array.isArray(list)) list = [];
    list = list
      .map((p) => sanitizeProvider(p))
      .filter((p) => p && p.apiKey && p.modelId);
    return list;
  },

  /** The provider currently selected for chats (active or first saved). */
  readActiveProvider() {
    const list = this.listProviders();
    if (list.length === 0) return null;
    const activeId = (readString(KEYS.aiActiveProvider) ?? '').trim();
    return list.find((p) => p.id === activeId) ?? list[0];
  },

  activeProviderId() {
    return this.readActiveProvider()?.id ?? null;
  },

  /**
   * Insert or update a provider and make it the active one ("Save & use").
   * Pass `id` to edit an existing entry; omit `apiKey` to keep the stored key.
   */
  saveProvider({ id, label, baseUrl, apiKey, modelId }) {
    const base = normalizeBase(baseUrl);
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      throw new Error('Base URL must start with http:// or https://');
    }
    if (!String(modelId ?? '').trim()) {
      throw new Error('Model ID is required.');
    }
    const list = this.listProviders();
    const existing = id ? list.find((p) => p.id === id) : null;
    let key = String(apiKey ?? '').trim();
    if (!key) {
      if (!existing) throw new Error('API key is required');
      key = existing.apiKey;
    }
    if (key.length < 8) throw new Error('That API key looks too short.');

    const provider = {
      id: existing?.id ?? newId(),
      label: String(label ?? '').trim() || AiPresets.labelForBase(base),
      baseUrl: base,
      apiKey: key,
      modelId: String(modelId).trim(),
      normalizedBaseUrl: base,
    };
    const next = existing
      ? list.map((p) => (p.id === provider.id ? provider : p))
      : [...list, provider];
    writeJson(KEYS.aiProviders, next);
    writeString(KEYS.aiActiveProvider, provider.id);
    return provider;
  },

  setActiveProvider(id) {
    const list = this.listProviders();
    if (!list.some((p) => p.id === id)) return;
    writeString(KEYS.aiActiveProvider, id);
  },

  deleteProvider(id) {
    const list = this.listProviders();
    const next = list.filter((p) => p.id !== id);
    writeJson(KEYS.aiProviders, next);
    if ((readString(KEYS.aiActiveProvider) ?? '') === id) {
      if (next.length > 0) writeString(KEYS.aiActiveProvider, next[0].id);
      else removeRaw(KEYS.aiActiveProvider);
    }
  },

  renameProvider(id, label) {
    const list = this.listProviders();
    const clean = String(label ?? '').trim();
    if (!clean) return;
    writeJson(
      KEYS.aiProviders,
      list.map((p) => (p.id === id ? { ...p, label: clean } : p))
    );
  },

  /** Update just the model of one provider (used by the chat model picker). */
  saveProviderModel(id, modelId) {
    const clean = String(modelId ?? '').trim();
    if (!clean) return;
    const list = this.listProviders();
    const provider = list.find((p) => p.id === id);
    if (!provider) return;
    writeJson(
      KEYS.aiProviders,
      list.map((p) => (p.id === id ? { ...p, modelId: clean } : p))
    );
  },

  providerMasked(p) {
    if (!p) return null;
    const masked = p.apiKey.length <= 4 ? '••••' : `••••${p.apiKey.slice(-4)}`;
    return `${p.label} • ${p.modelId} • ${masked}`;
  },

  /** "Label — model" summary for a provider row. */
  providerTitle(p) {
    if (!p) return '';
    return `${p.label} — ${p.modelId}`;
  },

  // --- Legacy single-slot API (kept for compatibility) ----------------------
  /** Alias of readActiveProvider(). */
  readCustomProvider() {
    return this.readActiveProvider();
  },

  /** Legacy save: creates a new provider entry (never merges into one slot). */
  saveCustomProvider({ baseUrl, apiKey, modelId }) {
    return this.saveProvider({ baseUrl, apiKey, modelId });
  },

  /** Legacy delete: removes the currently active provider. */
  deleteCustomProvider() {
    const active = this.readActiveProvider();
    if (active) this.deleteProvider(active.id);
  },

  customProviderMaskedPreview() {
    return this.providerMasked(this.readActiveProvider());
  },

  // --- Gemini --------------------------------------------------------------
  readSelectedGeminiModel() {
    const value = (readString(KEYS.geminiModel) ?? '').trim();
    return value || defaultGeminiModel;
  },

  saveSelectedGeminiModel(model) {
    const trimmed = String(model ?? '').trim();
    if (!trimmed) return;
    writeString(KEYS.geminiModel, trimmed);
  },

  // --- Mode resolution ------------------------------------------------------
  resolveActiveMode() {
    if (this.readActiveProvider() != null) return AiActiveMode.custom;
    if (geminiKey.isSet()) return AiActiveMode.gemini;
    return AiActiveMode.server;
  },

  describeActiveMode() {
    switch (this.resolveActiveMode()) {
      case AiActiveMode.custom: {
        const p = this.readActiveProvider();
        return this.providerTitle(p);
      }
      case AiActiveMode.gemini:
        return `Google Gemini — ${this.readSelectedGeminiModel()}`;
      default:
        return 'Campus server (default)';
    }
  },
};

// Run the legacy migration lazily once per session.
if (typeof window !== 'undefined' && !window.__cuetProviderMigrated) {
  window.__cuetProviderMigrated = true;
  try {
    migrateLegacyProvider(aiProvider.listProviders());
  } catch {
    /* ignore */
  }
}
