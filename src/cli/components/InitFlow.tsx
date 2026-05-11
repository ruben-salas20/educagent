// src/cli/components/InitFlow.tsx
// Flow interactivo del comando `educagent init`. Steps:
// welcome → domain → language → retention → llm_provider →
//   (ollama:  llm_ollama_loading → llm_ollama_model | llm_ollama_error)
//   (anthropic: llm_anthropic_model)
//   (none:    salta directo a summary)
// → summary → writing → done|error.
//
// Decisiones:
// - useApp().exit() — API correcta de Ink, deja que waitUntilExit() resuelva limpio.
// - El submit async vive afuera (prop onSubmit) — el componente no toca disco.
// - fetchCatalog es prop opcional para inyectar mock en tests (default real).
// - API keys NUNCA se piden en la TUI. Solo provider + model. Avisamos al usuario
//   que ANTHROPIC_API_KEY tiene que existir en su env antes de correr `learn`.

import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { useEffect, useState } from 'react';
import type { UserConfig, LLMConfig } from '../../ports/infra/IConfigStore.js';
import {
  fetchOllamaCatalog,
  formatBytes,
  type OllamaModelInfo,
  type OllamaCatalogError,
} from '../lib/ollamaCatalog.js';

type Step =
  | 'welcome'
  | 'domain'
  | 'language'
  | 'retention'
  | 'llm_provider'
  | 'llm_ollama_loading'
  | 'llm_ollama_model'
  | 'llm_ollama_error'
  | 'llm_anthropic_model'
  | 'summary'
  | 'writing'
  | 'done'
  | 'error';

type Domain = UserConfig['profile']['domain'];
type AgentLanguage = UserConfig['profile']['agentLanguage'];
type RetentionLevel = UserConfig['profile']['retentionLevel'];
type Provider = LLMConfig['provider'];

export interface InitFlowSubmitResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export interface InitFlowProps {
  onSubmit: (config: UserConfig) => Promise<InitFlowSubmitResult>;
  configPath: string;
  /** DI para tests. Si no se pasa, usa la implementación real. */
  fetchCatalog?: typeof fetchOllamaCatalog;
}

interface Item<V> {
  key?: string;
  label: string;
  value: V;
}

const DOMAIN_ITEMS: ReadonlyArray<Item<Domain>> = [
  { label: 'Programación / Software', value: 'programming' },
  { label: 'Matemáticas', value: 'math' },
  { label: 'Humanidades', value: 'humanities' },
  { label: 'Idiomas', value: 'languages' },
  { label: 'Otro', value: 'other' },
];

const LANGUAGE_ITEMS: ReadonlyArray<Item<AgentLanguage>> = [
  { label: 'Automático (según tu sistema)', value: 'auto' },
  { label: 'Español', value: 'es' },
  { label: 'English', value: 'en' },
];

const RETENTION_ITEMS: ReadonlyArray<Item<RetentionLevel>> = [
  { label: 'strict — máxima privacidad (recomendado)', value: 'strict' },
  { label: 'standard — detalle con TTL', value: 'standard' },
  { label: 'full — sin limpieza automática', value: 'full' },
];

const PROVIDER_ITEMS: ReadonlyArray<Item<Provider>> = [
  { label: 'Ollama — local, gratis (requiere instalación)', value: 'ollama' },
  { label: 'Anthropic — API remota (requiere ANTHROPIC_API_KEY)', value: 'anthropic' },
  { label: 'Sin LLM — placeholder, no analiza respuestas', value: 'none' },
];

// IDs reales confirmados con Context7 (Mayo 2026):
// - claude-sonnet-4-5-20250929 → balance calidad/costo (default).
// - claude-haiku-4-5-20251001  → rápido y barato.
// - claude-opus-4-5-20251101   → mejor calidad, más caro.
const ANTHROPIC_MODEL_ITEMS: ReadonlyArray<Item<string>> = [
  { label: 'Sonnet 4.5 — balance calidad/costo (recomendado)', value: 'claude-sonnet-4-5-20250929' },
  { label: 'Haiku 4.5 — rápido, económico', value: 'claude-haiku-4-5-20251001' },
  { label: 'Opus 4.5 — máxima calidad, más caro', value: 'claude-opus-4-5-20251101' },
];

const OLLAMA_ERROR_ITEMS: ReadonlyArray<Item<'retry' | 'switch_anthropic' | 'switch_none' | 'cancel'>> = [
  { label: 'Reintentar', value: 'retry' },
  { label: 'Cambiar a Anthropic', value: 'switch_anthropic' },
  { label: 'Continuar sin LLM (placeholder)', value: 'switch_none' },
  { label: 'Cancelar init', value: 'cancel' },
];

const CONFIRM_ITEMS: ReadonlyArray<Item<'confirm' | 'cancel'>> = [
  { label: 'Crear configuración', value: 'confirm' },
  { label: 'Cancelar', value: 'cancel' },
];

function domainLabel(d: Domain): string {
  return DOMAIN_ITEMS.find((i) => i.value === d)?.label ?? d;
}
function languageLabel(l: AgentLanguage): string {
  return LANGUAGE_ITEMS.find((i) => i.value === l)?.label ?? l;
}
function retentionLabel(r: RetentionLevel): string {
  return RETENTION_ITEMS.find((i) => i.value === r)?.label ?? r;
}
function providerLabel(p: Provider): string {
  return PROVIDER_ITEMS.find((i) => i.value === p)?.label ?? p;
}

function ollamaErrorHint(error: OllamaCatalogError): { title: string; body: string[] } {
  if (error.kind === 'not_running') {
    return {
      title: `No se pudo conectar a Ollama en ${error.url}.`,
      body: [
        '¿Ollama está corriendo? Comando: `ollama serve`',
        'Instalación: https://ollama.com/',
        `Detalle: ${error.cause}`,
      ],
    };
  }
  if (error.kind === 'empty_catalog') {
    return {
      title: `Ollama corre en ${error.url} pero no hay modelos descargados.`,
      body: [
        'Descargá uno con:',
        '  ollama pull qwen2.5:7b   (recomendado)',
        '  ollama pull gemma2:9b',
        'Después volvé a correr `educagent init`.',
      ],
    };
  }
  return {
    title: `Ollama respondió algo inesperado (${error.status ?? '?'}).`,
    body: [`Detalle: ${error.cause}`, `URL: ${error.url}`],
  };
}

export function InitFlow({
  onSubmit,
  configPath,
  fetchCatalog = fetchOllamaCatalog,
}: InitFlowProps): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [domain, setDomain] = useState<Domain>('programming');
  const [agentLanguage, setAgentLanguage] = useState<AgentLanguage>('auto');
  const [retentionLevel, setRetentionLevel] = useState<RetentionLevel>('strict');
  const [provider, setProvider] = useState<Provider>('none');
  const [model, setModel] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<ReadonlyArray<OllamaModelInfo>>([]);
  const [ollamaError, setOllamaError] = useState<OllamaCatalogError | null>(null);
  const [resultPath, setResultPath] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // En welcome esperamos 1.5s y avanzamos automáticamente a la primera pregunta —
  // así el usuario ve el branding antes del primer prompt.
  useEffect(() => {
    if (step !== 'welcome') return;
    const t = setTimeout(() => setStep('domain'), 1500);
    return () => clearTimeout(t);
  }, [step]);

  // Cuando entramos en llm_ollama_loading, disparamos el fetch al catalog.
  useEffect(() => {
    if (step !== 'llm_ollama_loading') return;
    let cancelled = false;
    void (async () => {
      const result = await fetchCatalog();
      if (cancelled) return;
      if (result.ok) {
        setOllamaModels(result.value);
        setOllamaError(null);
        setStep('llm_ollama_model');
      } else {
        setOllamaError(result.error);
        setStep('llm_ollama_error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, fetchCatalog]);

  // Cuando llegamos a 'done' o 'error', exit gracefully tras un breve delay.
  useEffect(() => {
    if (step !== 'done' && step !== 'error') return;
    const t = setTimeout(() => {
      exit(step === 'error' ? new Error(errorMsg || 'init failed') : undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, [step, exit, errorMsg]);

  const handleConfirm = async (value: 'confirm' | 'cancel'): Promise<void> => {
    if (value === 'cancel') {
      setErrorMsg('Cancelado por el usuario.');
      setStep('error');
      return;
    }
    setStep('writing');
    const llm: LLMConfig =
      provider === 'none' ? { provider: 'none', model: null } : { provider, model };
    const result = await onSubmit({
      schemaVersion: 2,
      profile: { domain, agentLanguage, retentionLevel },
      llm,
    });
    if (result.ok) {
      setResultPath(result.path ?? configPath);
      setStep('done');
    } else {
      setErrorMsg(result.error ?? 'unknown error');
      setStep('error');
    }
  };

  if (step === 'welcome') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            EducAgent
          </Text>
          <Text dimColor> · tutor inteligente con base psicopedagógica</Text>
        </Box>
        <Text>Vamos a configurar tu instalación.</Text>
      </Box>
    );
  }

  if (step === 'domain') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>¿Cuál es el dominio principal de aprendizaje?</Text>
        </Box>
        <SelectInput
          items={[...DOMAIN_ITEMS]}
          onSelect={(item) => {
            setDomain(item.value);
            setStep('language');
          }}
        />
      </Box>
    );
  }

  if (step === 'language') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>¿En qué idioma querés que responda el agente?</Text>
        </Box>
        <SelectInput
          items={[...LANGUAGE_ITEMS]}
          onSelect={(item) => {
            setAgentLanguage(item.value);
            setStep('retention');
          }}
        />
      </Box>
    );
  }

  if (step === 'retention') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Nivel de retención de datos (privacidad)</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>
            strict mantiene en RAM el detalle afectivo y solo guarda agregados anonimizados.
          </Text>
        </Box>
        <SelectInput
          items={[...RETENTION_ITEMS]}
          onSelect={(item) => {
            setRetentionLevel(item.value);
            setStep('llm_provider');
          }}
        />
      </Box>
    );
  }

  if (step === 'llm_provider') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>¿Qué LLM querés usar para analizar tus respuestas?</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>
            Las API keys NUNCA se guardan en el config. Viven en variables de entorno.
          </Text>
        </Box>
        <SelectInput
          items={[...PROVIDER_ITEMS]}
          onSelect={(item) => {
            setProvider(item.value);
            if (item.value === 'none') {
              setModel(null);
              setStep('summary');
            } else if (item.value === 'ollama') {
              setStep('llm_ollama_loading');
            } else {
              setStep('llm_anthropic_model');
            }
          }}
        />
      </Box>
    );
  }

  if (step === 'llm_ollama_loading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Buscando modelos Ollama…</Text>
        <Box marginTop={1}>
          <Text dimColor>Consultando http://localhost:11434/api/tags</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'llm_ollama_model') {
    const items: Array<Item<string>> = ollamaModels.map((m) => ({
      label: `${m.name} (${formatBytes(m.sizeBytes)})`,
      value: m.name,
    }));
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Elegí el modelo Ollama</Text>
        </Box>
        <SelectInput
          items={items}
          onSelect={(item) => {
            setModel(item.value);
            setStep('summary');
          }}
        />
      </Box>
    );
  }

  if (step === 'llm_ollama_error' && ollamaError) {
    const hint = ollamaErrorHint(ollamaError);
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">
            {hint.title}
          </Text>
        </Box>
        {hint.body.map((line, idx) => (
          <Text key={idx} dimColor>
            {line}
          </Text>
        ))}
        <Box marginTop={1}>
          <SelectInput
            items={[...OLLAMA_ERROR_ITEMS]}
            onSelect={(item) => {
              if (item.value === 'retry') {
                setStep('llm_ollama_loading');
              } else if (item.value === 'switch_anthropic') {
                setProvider('anthropic');
                setStep('llm_anthropic_model');
              } else if (item.value === 'switch_none') {
                setProvider('none');
                setModel(null);
                setStep('summary');
              } else {
                setErrorMsg('Cancelado por el usuario.');
                setStep('error');
              }
            }}
          />
        </Box>
      </Box>
    );
  }

  if (step === 'llm_anthropic_model') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Elegí el modelo Anthropic</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>
            Asegurate de tener `ANTHROPIC_API_KEY` en tu environment cuando corras
            `educagent learn`.
          </Text>
        </Box>
        <SelectInput
          items={[...ANTHROPIC_MODEL_ITEMS]}
          onSelect={(item) => {
            setModel(item.value);
            setStep('summary');
          }}
        />
      </Box>
    );
  }

  if (step === 'summary') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Resumen de tu configuración</Text>
        </Box>
        <Text>
          <Text color="cyan">Dominio:</Text> {domainLabel(domain)}
        </Text>
        <Text>
          <Text color="cyan">Idioma:</Text> {languageLabel(agentLanguage)}
        </Text>
        <Text>
          <Text color="cyan">Privacidad:</Text> {retentionLabel(retentionLevel)}
        </Text>
        <Text>
          <Text color="cyan">Provider:</Text> {providerLabel(provider)}
        </Text>
        <Text>
          <Text color="cyan">Modelo:</Text> {model ?? '—'}
        </Text>
        <Box marginTop={1}>
          <Text dimColor>Se va a crear: {configPath}</Text>
        </Box>
        <Box marginTop={1}>
          <SelectInput items={[...CONFIRM_ITEMS]} onSelect={(item) => void handleConfirm(item.value)} />
        </Box>
      </Box>
    );
  }

  if (step === 'writing') {
    return (
      <Box padding={1}>
        <Text>Creando configuración…</Text>
      </Box>
    );
  }

  if (step === 'done') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">
            Configuración creada
          </Text>
        </Box>
        <Text>Archivo: {resultPath}</Text>
        <Box marginTop={1}>
          <Text dimColor>Siguiente paso: `educagent learn`.</Text>
        </Box>
      </Box>
    );
  }

  // step === 'error'
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="red">
          No se pudo completar el init
        </Text>
      </Box>
      <Text>{errorMsg}</Text>
    </Box>
  );
}
