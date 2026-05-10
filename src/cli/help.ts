/**
 * Texto de ayuda del CLI. Extraído de bin.ts para que sea testeable sin
 * tocar process.argv. Solo español por ahora — i18n llega post walking-skeleton.
 */
export function printHelp(): void {
  console.log('Uso: educagent <comando> [opciones]');
  console.log('');
  console.log('Comandos:');
  console.log('  init       Inicializar EducAgent en el directorio actual');
  console.log('');
  console.log('Opciones:');
  console.log('  -v, --version    Mostrar versión');
  console.log('  -h, --help       Mostrar esta ayuda');
}
