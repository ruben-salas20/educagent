// src/cli/components/LearnFlow.tsx
// Componente Ink del comando `educagent learn` — walking skeleton MVP.
//
// 4 steps lineales: prompt → input → processing → feedback (o error).
// - El branding "EducAgent · modo Socrático" se mantiene en todos los frames
//   para que el usuario vea identidad consistente.
// - autoExit=true cierra Ink tras 2.5s mostrando el feedback. En tests pasamos
//   autoExit=false para inspeccionar frames sin que Ink desmonte el árbol.
//
// TODO LLM: el step 'processing' hoy es instantáneo porque la heurística
// placeholder no llama a ningún LLM. Cuando llegue el adapter de LLM va a
// haber latencia real y vale la pena meter un spinner (ink-spinner).

import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';

type Step = 'prompt' | 'input' | 'processing' | 'feedback' | 'error';

export type LearnFlowSubmitResult =
  | { readonly ok: true; readonly feedbackText: string }
  | { readonly ok: false; readonly error: string };

export interface LearnFlowProps {
  readonly promptText: string;
  readonly onSubmit: (responseText: string) => Promise<LearnFlowSubmitResult>;
  /** Si false, no llama a exit() tras mostrar feedback/error. Default true. */
  readonly autoExit?: boolean;
}

const PROMPT_DURATION_MS = 800;
const EXIT_DELAY_MS = 2500;

export function LearnFlow({
  promptText,
  onSubmit,
  autoExit = true,
}: LearnFlowProps): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('prompt');
  const [response, setResponse] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-avance prompt → input para que el usuario vea la pregunta antes del cursor.
  useEffect(() => {
    if (step !== 'prompt') return;
    const t = setTimeout(() => setStep('input'), PROMPT_DURATION_MS);
    return () => clearTimeout(t);
  }, [step]);

  // Auto-exit gracioso tras feedback/error. Desactivable en tests.
  useEffect(() => {
    if (step !== 'feedback' && step !== 'error') return;
    if (!autoExit) return;
    const t = setTimeout(() => {
      exit(step === 'error' ? new Error(errorMsg || 'learn failed') : undefined);
    }, EXIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [step, autoExit, exit, errorMsg]);

  const handleSubmit = async (value: string): Promise<void> => {
    setStep('processing');
    const result = await onSubmit(value);
    if (result.ok) {
      setFeedbackText(result.feedbackText);
      setStep('feedback');
    } else {
      setErrorMsg(result.error);
      setStep('error');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          EducAgent
        </Text>
        <Text dimColor> · modo Socrático</Text>
      </Box>

      {step === 'prompt' && (
        <Box flexDirection="column">
          <Text>{promptText}</Text>
        </Box>
      )}

      {step === 'input' && (
        <Box flexDirection="column">
          <Text>{promptText}</Text>
          <Box marginTop={1}>
            <Text color="green">{'> '}</Text>
            <TextInput
              value={response}
              onChange={setResponse}
              onSubmit={(v) => void handleSubmit(v)}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>(Enter para enviar — vacío para skip)</Text>
          </Box>
        </Box>
      )}

      {step === 'processing' && (
        <Box>
          <Text dimColor>Procesando tu respuesta…</Text>
        </Box>
      )}

      {step === 'feedback' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>{feedbackText}</Text>
          </Box>
          <Text dimColor>
            Esto es un walking skeleton — `learn` real va a tener loop, items
            múltiples y feedback generado por LLM.
          </Text>
        </Box>
      )}

      {step === 'error' && (
        <Box flexDirection="column">
          <Text color="red">Hubo un error procesando la respuesta:</Text>
          <Text dimColor>{errorMsg}</Text>
        </Box>
      )}
    </Box>
  );
}
