import { Box, Text } from 'ink';
import { useEffect } from 'react';

interface WelcomeProps {
  /**
   * Si true (default), el componente llama a process.exit(0) tras 2s.
   * En tests pasar `false` para evitar que el runner muera.
   */
  autoExit?: boolean;
}

/**
 * Walking-skeleton del flow `educagent init`. Sin lógica real — solo demuestra
 * que la cadena React → Ink → TUI funciona end-to-end.
 *
 * El auto-exit existe porque `init` ahora mismo es puramente decorativo: sin él
 * el comando quedaría colgado esperando input que nunca llega. Cuando init real
 * se construya, este componente se reemplaza por el flow de configuración.
 */
export function Welcome({ autoExit = true }: WelcomeProps): React.JSX.Element {
  useEffect(() => {
    if (!autoExit) {
      return;
    }
    const timer = setTimeout(() => {
      process.exit(0);
    }, 2000);
    return () => clearTimeout(timer);
  }, [autoExit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          EducAgent
        </Text>
        <Text dimColor> · tutor inteligente con base psicopedagógica</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Bienvenido. Próximamente: setup interactivo del proyecto.</Text>
      </Box>
      <Box>
        <Text dimColor>Esto es un walking skeleton — `init` real está en construcción.</Text>
      </Box>
    </Box>
  );
}
