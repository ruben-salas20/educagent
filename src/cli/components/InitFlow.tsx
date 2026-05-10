// src/cli/components/InitFlow.tsx
// Flow interactivo del comando `educagent init`. 6 pantallas:
// welcome → domain → language → retention → summary → done|error.
//
// Decisiones:
// - useApp().exit() en vez de process.exit() — API correcta de Ink, deja
//   que `render(...).waitUntilExit()` resuelva limpio.
// - El submit async vive afuera (prop onSubmit) — el componente no toca disco.
//   Esto lo deja testeable sin tmpdir.

import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { useEffect, useState } from 'react';
import type { UserConfig } from '../../ports/infra/IConfigStore.js';

type Step = 'welcome' | 'domain' | 'language' | 'retention' | 'summary' | 'writing' | 'done' | 'error';

type Domain = UserConfig['profile']['domain'];
type AgentLanguage = UserConfig['profile']['agentLanguage'];
type RetentionLevel = UserConfig['profile']['retentionLevel'];

export interface InitFlowSubmitResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export interface InitFlowProps {
  onSubmit: (config: UserConfig) => Promise<InitFlowSubmitResult>;
  configPath: string;
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

export function InitFlow({ onSubmit, configPath }: InitFlowProps): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [domain, setDomain] = useState<Domain>('programming');
  const [agentLanguage, setAgentLanguage] = useState<AgentLanguage>('auto');
  const [retentionLevel, setRetentionLevel] = useState<RetentionLevel>('strict');
  const [resultPath, setResultPath] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // En welcome esperamos 1.5s y avanzamos automáticamente a la primera pregunta —
  // así el usuario ve el branding antes del primer prompt.
  useEffect(() => {
    if (step !== 'welcome') return;
    const t = setTimeout(() => setStep('domain'), 1500);
    return () => clearTimeout(t);
  }, [step]);

  // Cuando llegamos a 'done' o 'error', exit gracefully tras un breve delay
  // para que el usuario alcance a leer el mensaje final.
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
    const result = await onSubmit({
      schemaVersion: 1,
      profile: { domain, agentLanguage, retentionLevel },
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
          <Text dimColor>Siguiente paso: `educagent learn` (en construcción).</Text>
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
