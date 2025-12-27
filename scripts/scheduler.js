import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ejecuta el script de scraping
 */
function runScraping() {
  console.log(`\n⏰ Ejecutando scraping programado: ${new Date().toISOString()}`);
  
  const scriptPath = path.join(__dirname, 'scrape.js');
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });
  
  child.on('close', (code) => {
    console.log(`✅ Scraping completado con código: ${code}`);
  });
  
  child.on('error', (error) => {
    console.error(`❌ Error ejecutando scraping: ${error.message}`);
  });
}

/**
 * Programa ejecución cada 3 meses (1er día del mes, cada 3 meses)
 * Enero, Abril, Julio, Octubre a las 2:00 AM
 */
cron.schedule('0 2 1 1,4,7,10 *', () => {
  runScraping();
}, {
  scheduled: true,
  timezone: "America/Mexico_City"
});

console.log('📅 Scheduler iniciado - Ejecutará scraping cada 3 meses (Ene, Abr, Jul, Oct)');
console.log('   Próxima ejecución: 1ro de cada trimestre a las 2:00 AM');

// Ejecutar inmediatamente si se pasa --now
if (process.argv.includes('--now')) {
  console.log('\n🚀 Ejecutando ahora...');
  runScraping();
}

