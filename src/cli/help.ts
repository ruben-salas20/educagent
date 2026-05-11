/**
 * Texto de ayuda del CLI. Extraído de bin.ts para que sea testeable sin
 * tocar process.argv. Solo español por ahora — i18n llega post walking-skeleton.
 */
export function printHelp(): void {
  console.log('Uso: educagent <comando> [opciones]');
  console.log('');
  console.log('Comandos:');
  console.log('  init       Inicializar EducAgent (elegís provider LLM en la TUI)');
  console.log('  learn      Iniciar una sesión de aprendizaje (walking skeleton)');
  console.log('');
  console.log('Opciones:');
  console.log('  -v, --version    Mostrar versión');
  console.log('  -h, --help       Mostrar esta ayuda');
  console.log('');
  console.log('Variables de entorno:');
  console.log('  ANTHROPIC_API_KEY        Requerida si provider=anthropic. NUNCA se guarda en config.');
  console.log('');
  console.log('Power-user overrides (tienen prioridad sobre el config):');
  console.log('  EDUCAGENT_LLM_PROVIDER   Forzar provider para esta corrida. Opciones: ollama, anthropic.');
  console.log('  OLLAMA_MODEL             Forzar modelo Ollama.');
  console.log('  OLLAMA_URL               Forzar URL Ollama. Default: http://localhost:11434.');
  console.log('  ANTHROPIC_MODEL          Forzar modelo Claude.');
}
