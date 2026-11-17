// AI Settings — port of ai_settings_screen.dart, extended for multi-provider.
// Connect any number of OpenAI-compatible providers (OpenRouter / OpenAI /
// Groq / Together / Mistral / Ollama / LM Studio / self-hosted), switch the
// active one, plus a personal Google Gemini key.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { testCustomProvider } from '../../lib/ai/chatService.js';
import { geminiKey } from '../../lib/ai/geminiKey.js';
import { AiActiveMode, AiPresets, aiProvider } from '../../lib/ai/providers.js';

function OptionCard({ icon, accentClass, badge, title, subtitle, active, children }) {
  return (
    <Card className="rounded-2xl">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${accentClass.bg}`}>
          <Icon name={icon} size={22} className={accentClass.text} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-label-sm font-extrabold tracking-widest ${accentClass.text}`}>
              {badge}
            </span>
            {active && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-extrabold text-success">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-title-md font-extrabold text-ink">{title}</p>
        </div>
      </div>
      <p className="mt-1 text-body-sm text-ink-muted">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function StatusStrip({ icon, tone, label, action = null }) {
  return (
    <div className={`mb-2.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${tone.bg}`}>
      <Icon name={icon} size={17} className={tone.text} />
      <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">{label}</span>
      {action}
    </div>
  );
}

function Sheet({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-outline sm:hidden" />
        <p className="shrink-0 px-5 pt-3 pb-1 text-title-md font-bold text-ink">{title}</p>
        <div className="min-h-0 flex-1 overflow-y-auto pb-3">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { id: null, label: '', baseUrl: '', apiKey: '', modelId: '' };

export default function AiSettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  // Saved providers + active selection
  const [providers, setProviders] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeMode, setActiveMode] = useState(AiActiveMode.server);
  const [activeModeText, setActiveModeText] = useState('Campus server (default)');

  // Add / edit form
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [keyObscure, setKeyObscure] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState(null);

  // Gemini option
  const [geminiInput, setGeminiInput] = useState('');
  const [geminiObscure, setGeminiObscure] = useState(true);
  const [geminiMask, setGeminiMask] = useState(null);
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');

  const [baseSheet, setBaseSheet] = useState(false);
  const [modelSheet, setModelSheet] = useState(false);
  const [geminiModelSheet, setGeminiModelSheet] = useState(false);

  const reload = () => {
    setProviders(aiProvider.listProviders());
    setActiveId(aiProvider.activeProviderId());
    setActiveMode(aiProvider.resolveActiveMode());
    setActiveModeText(aiProvider.describeActiveMode());
    setGeminiMask(geminiKey.maskedPreview());
    setGeminiModel(aiProvider.readSelectedGeminiModel());
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Provider form --------------------------------------------------------

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setKeyObscure(true);
    setFormOpen(true);
  };

  const openEditForm = (provider) => {
    setForm({
      id: provider.id,
      label: provider.label,
      baseUrl: provider.baseUrl,
      apiKey: '', // blank keeps the stored key
      modelId: provider.modelId,
    });
    setKeyObscure(true);
    setFormOpen(true);
  };

  const saveForm = () => {
    setBusy(true);
    try {
      const saved = aiProvider.saveProvider({
        id: form.id ?? undefined,
        label: form.label,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey.trim(), // blank on edit keeps the stored key
        modelId: form.modelId,
      });
      toast.success(
        form.id
          ? `${saved.label} updated and set active`
          : `${saved.label} connected and set active`
      );
      setForm(EMPTY_FORM);
      setFormOpen(false);
      reload();
    } catch (error) {
      toast.error(String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const useProvider = (provider) => {
    aiProvider.setActiveProvider(provider.id);
    reload();
    toast.success(`Switched to ${aiProvider.providerTitle(provider)}`);
  };

  const removeProvider = (provider) => {
    aiProvider.deleteProvider(provider.id);
    reload();
    if (form.id === provider.id) {
      setForm(EMPTY_FORM);
      setFormOpen(false);
    }
    toast.success(`${provider.label} removed`);
  };

  const testProvider = async (provider, { keyOverride } = {}) => {
    const apiKey = keyOverride ?? provider.apiKey;
    setTestingId(provider.id ?? 'form');
    try {
      const latencyMs = await testCustomProvider({ ...provider, apiKey });
      toast.success(`${provider.label || 'Provider'} connected — reply in ${latencyMs} ms`);
    } catch (error) {
      toast.error(String(error?.message ?? error));
    } finally {
      setTestingId(null);
    }
  };

  // --- Gemini ---------------------------------------------------------------

  const saveGeminiKey = () => {
    try {
      geminiKey.save(geminiInput);
      setGeminiInput('');
      toast.success('Gemini key saved securely on this device');
      reload();
    } catch (error) {
      toast.error(String(error?.message ?? error));
    }
  };

  const removeGeminiKey = () => {
    geminiKey.delete();
    toast.success('Gemini key removed');
    reload();
  };

  const pickGeminiModel = (model) => {
    aiProvider.saveSelectedGeminiModel(model);
    setGeminiModel(model);
    setGeminiModelSheet(false);
    toast.success(`Default Gemini model set to ${model}`);
  };

  // --- Form helpers ---------------------------------------------------------

  const baseSuggestions = AiPresets.customBases[form.baseUrl.trim()] ?? [];
  const editing = form.id != null;

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="AI Settings" onBack={() => navigate(-1)} />

      {/* Active pathway status */}
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary/10 to-primary-container/20 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary dark:text-primary-light">
          <Icon name="auto_awesome" size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-label-sm font-extrabold tracking-widest text-primary dark:text-primary-light">
            ACTIVE AI PATHWAY
          </p>
          <p className="truncate text-body-md font-semibold text-ink">{activeModeText}</p>
          <p className="text-label-sm text-ink-muted">
            Priority: Active provider → Gemini key → Campus server. If a provider fails, the next
            saved one is tried automatically.
          </p>
        </div>
      </div>

      {/* Connected providers */}
      <div className="mt-5">
        <OptionCard
          icon="hub"
          accentClass={{ bg: 'bg-info/15', text: 'text-info' }}
          badge="AI PROVIDERS"
          title="Connected providers"
          subtitle="Any OpenAI-compatible endpoint — OpenRouter, OpenAI, Groq, Together, Mistral, Ollama…"
          active={activeMode === AiActiveMode.custom}
        >
          {providers.length === 0 && (
            <StatusStrip
              icon="cloud_off"
              tone={{ bg: 'bg-warning/10', text: 'text-warning' }}
              label="No providers connected yet"
            />
          )}

          {providers.map((provider) => {
            const isActive = provider.id === activeId && activeMode === AiActiveMode.custom;
            return (
              <div
                key={provider.id}
                className={`mb-2 rounded-xl border px-3 py-2.5 ${
                  isActive ? 'border-success/50 bg-success/5' : 'border-outline bg-surface'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    name={isActive ? 'radio_button_checked' : 'radio_button_unchecked'}
                    size={18}
                    className={
                      isActive ? 'text-success' : 'text-ink-muted'
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-body-md font-semibold text-ink">
                      {provider.label}
                      {isActive && (
                        <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-extrabold text-success">
                          IN USE
                        </span>
                      )}
                    </p>
                    <p className="truncate text-label-md text-ink-muted">
                      {provider.modelId} • {AiPresets.labelForBase(provider.baseUrl)} •{' '}
                      {`••••${provider.apiKey.slice(-4)}`}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {!isActive && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => useProvider(provider)}
                      className="rounded-lg bg-primary px-2.5 py-1.5 text-label-md font-semibold text-white hover:bg-primary-light disabled:opacity-50"
                    >
                      Use
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={testingId != null}
                    onClick={() => testProvider(provider)}
                    className="rounded-lg border border-primary px-2.5 py-1.5 text-label-md font-semibold text-primary hover:bg-primary/5 disabled:opacity-50 dark:text-primary-light"
                  >
                    {testingId === provider.id ? <Spinner size={13} /> : 'Test'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(provider)}
                    className="rounded-lg px-2.5 py-1.5 text-label-md font-semibold text-ink hover:bg-surface-variant"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={testingId != null}
                    onClick={() => removeProvider(provider)}
                    className="rounded-lg px-2.5 py-1.5 text-label-md font-semibold text-critical hover:bg-critical/5 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add / edit form */}
          {formOpen ? (
            <div className="mt-3 rounded-xl border border-outline p-3">
              <p className="text-label-md font-extrabold tracking-widest text-ink-muted">
                {editing ? 'EDIT PROVIDER' : 'NEW PROVIDER'}
              </p>

              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Nickname (optional) — e.g. Work key"
                spellCheck={false}
                className="mt-2 w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
              />

              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="Base URL — https://openrouter.ai/api/v1"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  title="Pick a known provider"
                  onClick={() => setBaseSheet(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-variant hover:text-ink"
                >
                  <Icon name="list" size={20} />
                </button>
              </div>

              <div className="relative mt-2">
                <input
                  type={keyObscure ? 'password' : 'text'}
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder={
                    editing ? 'API key (leave blank to keep saved)' : 'API key (sk-or-...)'
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 pr-11 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={keyObscure ? 'Show' : 'Hide'}
                  onClick={() => setKeyObscure((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted hover:text-ink"
                >
                  <Icon name={keyObscure ? 'visibility_off' : 'visibility'} size={19} />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={form.modelId}
                  onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                  placeholder="Model ID — openrouter/auto"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  title="Model suggestions"
                  onClick={() => setModelSheet(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-variant hover:text-ink"
                >
                  <Icon name="lightbulb" size={20} />
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy || testingId != null}
                  onClick={() => testProvider(
                    {
                      baseUrl: form.baseUrl.trim(),
                      modelId: form.modelId.trim(),
                      label: form.label.trim() || AiPresets.labelForBase(form.baseUrl),
                      normalizedBaseUrl: form.baseUrl.trim().replace(/\/$/, ''),
                    },
                    { keyOverride: form.apiKey.trim() }
                  )}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary px-3 py-2.5 text-label-lg font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50 dark:text-primary-light"
                >
                  {testingId === 'form' ? <Spinner size={16} /> : <Icon name="network_check" size={18} />} Test
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveForm}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-label-lg font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
                >
                  <Icon name="save" size={18} /> {editing ? 'Save' : 'Save & use'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setFormOpen(false);
                  }}
                  className="rounded-xl px-3 py-2.5 text-label-lg font-semibold text-ink-muted hover:bg-surface-variant"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAddForm}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/60 px-3 py-2.5 text-label-lg font-semibold text-primary hover:bg-primary/5 dark:text-primary-light"
            >
              <Icon name="add" size={18} /> Add provider
            </button>
          )}

          <p className="mt-2 text-label-sm text-ink-muted">
            Keys are stored on this device only and sent solely to the endpoint you choose — never
            to campus servers. Save switches the active provider; switch anytime from the list or
            the chat model sheet.
          </p>
        </OptionCard>
      </div>

      {/* Google Gemini */}
      <div className="mt-5">
        <OptionCard
          icon="auto_awesome"
          accentClass={{ bg: 'bg-accent/15', text: 'text-accent' }}
          badge="GEMINI FALLBACK"
          title="Google Gemini"
          subtitle="Free keys from aistudio.google.com/apikey — used when no provider is active"
          active={activeMode === AiActiveMode.gemini}
        >
          <StatusStrip
            icon={geminiMask ? 'key' : 'key_off'}
            tone={geminiMask ? { bg: 'bg-success/10', text: 'text-success' } : { bg: 'bg-warning/10', text: 'text-warning' }}
            label={geminiMask ? `Key set — ${geminiMask}` : 'No personal key set'}
            action={
              geminiMask ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={removeGeminiKey}
                  className="text-label-lg font-semibold text-critical hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null
            }
          />

          <div className="relative">
            <input
              type={geminiObscure ? 'password' : 'text'}
              value={geminiInput}
              onChange={(e) => setGeminiInput(e.target.value)}
              placeholder="Paste a new Gemini API key (AIza...)"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-outline bg-surface px-3.5 py-3 pr-11 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              aria-label={geminiObscure ? 'Show' : 'Hide'}
              onClick={() => setGeminiObscure((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted hover:text-ink"
            >
              <Icon name={geminiObscure ? 'visibility_off' : 'visibility'} size={19} />
            </button>
          </div>

          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setGeminiModelSheet(true)}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary px-3 py-2.5 text-label-lg font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50 dark:text-primary-light"
            >
              <Icon name="memory" size={18} />
              <span className="truncate">{geminiModel}</span>
            </button>
            <button
              type="button"
              disabled={busy || !geminiInput.trim()}
              onClick={saveGeminiKey}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-label-lg font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              {busy ? <Spinner size={16} /> : <Icon name="save" size={18} />} Save
            </button>
          </div>
        </OptionCard>
      </div>

      {/* Sheets */}
      <Sheet open={baseSheet} title="Choose a provider endpoint" onClose={() => setBaseSheet(false)}>
        {Object.keys(AiPresets.customBases).map((base) => (
          <button
            key={base}
            type="button"
            onClick={() => {
              setForm((f) => ({
                ...f,
                baseUrl: base,
                modelId: f.modelId || AiPresets.customBases[base]?.[0] || '',
              }));
              setBaseSheet(false);
            }}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
          >
            <Icon name="dns" size={20} className="shrink-0 text-ink-muted" />
            <span className="min-w-0">
              <span className="block text-body-lg font-semibold text-ink">
                {AiPresets.labelForBase(base)}
              </span>
              <span className="block truncate text-label-md text-ink-muted">{base}</span>
            </span>
          </button>
        ))}
      </Sheet>

      <Sheet
        open={modelSheet}
        title={`Model IDs for ${AiPresets.labelForBase(form.baseUrl) || 'your endpoint'}`}
        onClose={() => setModelSheet(false)}
      >
        {baseSuggestions.map((model) => (
          <button
            key={model}
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, modelId: model }));
              setModelSheet(false);
            }}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
          >
            <Icon name="memory" size={20} className="shrink-0 text-ink-muted" />
            <span className="truncate text-body-lg text-ink">{model}</span>
          </button>
        ))}
        {baseSuggestions.length === 0 && (
          <p className="px-5 py-4 text-body-sm text-ink-muted">
            No suggestions for this endpoint — type any OpenAI-compatible model ID.
          </p>
        )}
      </Sheet>

      <Sheet open={geminiModelSheet} title="Gemini model" onClose={() => setGeminiModelSheet(false)}>
        {AiPresets.geminiModels.map((model) => (
          <button
            key={model}
            type="button"
            onClick={() => pickGeminiModel(model)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
          >
            <Icon
              name={model === geminiModel ? 'radio_button_checked' : 'radio_button_unchecked'}
              size={20}
              className={model === geminiModel ? 'text-primary dark:text-primary-light' : 'text-ink-muted'}
            />
            <span className="text-body-lg text-ink">{model}</span>
          </button>
        ))}
      </Sheet>
    </PageShell>
  );
}
