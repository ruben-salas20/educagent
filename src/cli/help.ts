/**
 * Texto de ayuda del CLI. Extraído de bin.ts para que sea testeable sin
 * tocar process.argv. Solo español por ahora — i18n llega post walking-skeleton.
 */
export function printHelp(): void {
  console.log('Uso: educagent <comando> [opciones]');
  console.log('');
  console.log('Comandos:');
  console.log('  init       Inicializar EducAgent en el directorio actual');
  console.log('  learn      Iniciar una sesión de aprendizaje (walking skeleton)');
  console.log('');
  console.log('Opciones:');
  console.log('  -v, --version    Mostrar versión');
  console.log('  -h, --help       Mostrar esta ayuda');
  console.log('');
  console.log('Variables de entorno:');
  console.log('  EDUCAGENT_LLM_PROVIDER   Provider LLM. Default: ollama. Opciones: ollama, anthropic.');
  console.log('  OLLAMA_MODEL             Modelo Ollama. Default: gemma4:latest.');
  console.log('  OLLAMA_URL               URL Ollama. Default: http://localhost:11434.');
  console.log('  ANTHROPIC_API_KEY        Requerida si EDUCAGENT_LLM_PROVIDER=anthropic.');
  console.log('  ANTHROPIC_MODEL          Modelo Claude. Default: claude-sonnet-4-5-20250929.');
}
