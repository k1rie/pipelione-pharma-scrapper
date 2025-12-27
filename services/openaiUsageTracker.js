import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de límites (desde .env o valores por defecto)
const LIMITS = {
  // Límite de requests por minuto (para evitar rate limits)
  REQUESTS_PER_MINUTE: parseInt(process.env.OPENAI_LIMIT_REQUESTS_PER_MINUTE) || 25,
  
  // Límite de requests por día
  REQUESTS_PER_DAY: parseInt(process.env.OPENAI_LIMIT_REQUESTS_PER_DAY) || 500,
  
  // Límite de requests por ejecución (sesión actual)
  REQUESTS_PER_SESSION: parseInt(process.env.OPENAI_LIMIT_REQUESTS_PER_SESSION) || 100,
  
  // Límite de costo diario estimado en USD (opcional)
  COST_PER_DAY_USD: parseFloat(process.env.OPENAI_LIMIT_COST_PER_DAY) || 10.0,
};

// Archivo para persistir el tracking diario
const USAGE_FILE = path.join(__dirname, '../data/openai-usage.json');

// Estructura de datos de uso
let usageData = {
  daily: {
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    requests: 0,
    estimatedCost: 0,
    lastReset: new Date().toISOString(),
  },
  session: {
    requests: 0,
    startTime: new Date().toISOString(),
  },
  minuteWindow: {
    requests: [],
    // Array de timestamps de requests en la última ventana de 1 minuto
  },
};

// Cargar datos existentes si el archivo existe
function loadUsageData() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
      
      // Verificar si es el mismo día
      const today = new Date().toISOString().split('T')[0];
      if (data.daily.date === today) {
        usageData.daily = data.daily;
      } else {
        // Nuevo día, resetear contador diario
        usageData.daily = {
          date: today,
          requests: 0,
          estimatedCost: 0,
          lastReset: new Date().toISOString(),
        };
      }
      
      // Mantener datos de sesión
      if (data.session) {
        usageData.session = data.session;
      }
    }
  } catch (error) {
    console.warn('⚠️  No se pudo cargar datos de uso previos:', error.message);
  }
}

// Guardar datos de uso
function saveUsageData() {
  try {
    // Crear directorio si no existe
    const dir = path.dirname(USAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usageData, null, 2), 'utf8');
  } catch (error) {
    console.warn('⚠️  No se pudo guardar datos de uso:', error.message);
  }
}

// Limpiar requests antiguos de la ventana de 1 minuto
function cleanMinuteWindow() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000; // 60 segundos
  
  usageData.minuteWindow.requests = usageData.minuteWindow.requests.filter(
    timestamp => timestamp > oneMinuteAgo
  );
}

// Calcular costo estimado por request
// gpt-4o-mini: ~$0.00015 por 1K tokens input, ~$0.0006 por 1K tokens output
// Estimación conservadora: ~$0.001 por request promedio
function estimateCost(inputTokens = 0, outputTokens = 0) {
  const INPUT_COST_PER_1K = 0.00015;
  const OUTPUT_COST_PER_1K = 0.0006;
  
  const inputCost = (inputTokens / 1000) * INPUT_COST_PER_1K;
  const outputCost = (outputTokens / 1000) * OUTPUT_COST_PER_1K;
  
  return inputCost + outputCost;
}

/**
 * Registra un request a OpenAI
 * @param {number} inputTokens - Tokens de entrada (opcional)
 * @param {number} outputTokens - Tokens de salida (opcional)
 * @returns {object} - Estado del tracking
 */
export function trackRequest(inputTokens = 0, outputTokens = 0) {
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  
  // Verificar si es un nuevo día
  if (usageData.daily.date !== today) {
    usageData.daily = {
      date: today,
      requests: 0,
      estimatedCost: 0,
      lastReset: new Date().toISOString(),
    };
  }
  
  // Limpiar ventana de 1 minuto
  cleanMinuteWindow();
  
  // Agregar request a la ventana de 1 minuto
  usageData.minuteWindow.requests.push(now);
  
  // Incrementar contadores
  usageData.daily.requests++;
  usageData.session.requests++;
  
  // Calcular y agregar costo estimado
  const cost = estimateCost(inputTokens, outputTokens);
  usageData.daily.estimatedCost += cost;
  
  // Guardar datos
  saveUsageData();
  
  return {
    daily: { ...usageData.daily },
    session: { ...usageData.session },
    minuteWindow: {
      requests: usageData.minuteWindow.requests.length,
    },
  };
}

/**
 * Verifica si se puede hacer un request (no se han alcanzado los límites)
 * @returns {object} - { allowed: boolean, reason?: string, stats: object }
 */
export function canMakeRequest() {
  const today = new Date().toISOString().split('T')[0];
  
  // Verificar si es un nuevo día
  if (usageData.daily.date !== today) {
    usageData.daily = {
      date: today,
      requests: 0,
      estimatedCost: 0,
      lastReset: new Date().toISOString(),
    };
    saveUsageData();
  }
  
  // Limpiar ventana de 1 minuto
  cleanMinuteWindow();
  
  const stats = {
    daily: {
      requests: usageData.daily.requests,
      limit: LIMITS.REQUESTS_PER_DAY,
      remaining: LIMITS.REQUESTS_PER_DAY - usageData.daily.requests,
      estimatedCost: usageData.daily.estimatedCost.toFixed(4),
      costLimit: LIMITS.COST_PER_DAY_USD,
    },
    session: {
      requests: usageData.session.requests,
      limit: LIMITS.REQUESTS_PER_SESSION,
      remaining: LIMITS.REQUESTS_PER_SESSION - usageData.session.requests,
    },
    minuteWindow: {
      requests: usageData.minuteWindow.requests.length,
      limit: LIMITS.REQUESTS_PER_MINUTE,
      remaining: LIMITS.REQUESTS_PER_MINUTE - usageData.minuteWindow.requests.length,
    },
  };
  
  // Verificar límites
  if (usageData.daily.requests >= LIMITS.REQUESTS_PER_DAY) {
    return {
      allowed: false,
      reason: `Límite diario alcanzado: ${usageData.daily.requests}/${LIMITS.REQUESTS_PER_DAY} requests`,
      stats,
    };
  }
  
  if (usageData.daily.estimatedCost >= LIMITS.COST_PER_DAY_USD) {
    return {
      allowed: false,
      reason: `Límite de costo diario alcanzado: $${usageData.daily.estimatedCost.toFixed(4)}/${LIMITS.COST_PER_DAY_USD} USD`,
      stats,
    };
  }
  
  if (usageData.session.requests >= LIMITS.REQUESTS_PER_SESSION) {
    return {
      allowed: false,
      reason: `Límite de sesión alcanzado: ${usageData.session.requests}/${LIMITS.REQUESTS_PER_SESSION} requests`,
      stats,
    };
  }
  
  if (usageData.minuteWindow.requests.length >= LIMITS.REQUESTS_PER_MINUTE) {
    const oldestRequest = usageData.minuteWindow.requests[0];
    const waitTime = Math.ceil((60000 - (Date.now() - oldestRequest)) / 1000);
    return {
      allowed: false,
      reason: `Rate limit: ${usageData.minuteWindow.requests.length}/${LIMITS.REQUESTS_PER_MINUTE} requests por minuto. Espera ${waitTime} segundos`,
      stats,
      waitTime,
    };
  }
  
  return {
    allowed: true,
    stats,
  };
}

/**
 * Obtiene estadísticas de uso actuales
 */
export function getUsageStats() {
  const today = new Date().toISOString().split('T')[0];
  
  if (usageData.daily.date !== today) {
    usageData.daily = {
      date: today,
      requests: 0,
      estimatedCost: 0,
      lastReset: new Date().toISOString(),
    };
  }
  
  cleanMinuteWindow();
  
  return {
    daily: {
      requests: usageData.daily.requests,
      limit: LIMITS.REQUESTS_PER_DAY,
      remaining: LIMITS.REQUESTS_PER_DAY - usageData.daily.requests,
      estimatedCost: parseFloat(usageData.daily.estimatedCost.toFixed(4)),
      costLimit: LIMITS.COST_PER_DAY_USD,
      date: usageData.daily.date,
    },
    session: {
      requests: usageData.session.requests,
      limit: LIMITS.REQUESTS_PER_SESSION,
      remaining: LIMITS.REQUESTS_PER_SESSION - usageData.session.requests,
      startTime: usageData.session.startTime,
    },
    minuteWindow: {
      requests: usageData.minuteWindow.requests.length,
      limit: LIMITS.REQUESTS_PER_MINUTE,
      remaining: LIMITS.REQUESTS_PER_MINUTE - usageData.minuteWindow.requests.length,
    },
    limits: LIMITS,
  };
}

/**
 * Resetea el contador de sesión
 */
export function resetSession() {
  usageData.session = {
    requests: 0,
    startTime: new Date().toISOString(),
  };
  saveUsageData();
  console.log('🔄 Sesión de OpenAI reseteada');
}

/**
 * Espera hasta que se pueda hacer un request (si hay rate limit)
 */
export async function waitIfNeeded() {
  const check = canMakeRequest();
  
  if (!check.allowed && check.waitTime) {
    console.log(`⏳ Esperando ${check.waitTime} segundos por rate limit...`);
    await new Promise(resolve => setTimeout(resolve, check.waitTime * 1000));
    // Limpiar ventana después de esperar
    cleanMinuteWindow();
  }
}

// Cargar datos al inicializar el módulo
loadUsageData();

// Log inicial de límites configurados
console.log('📊 Límites de OpenAI configurados:');
console.log(`   - Requests/minuto: ${LIMITS.REQUESTS_PER_MINUTE}`);
console.log(`   - Requests/día: ${LIMITS.REQUESTS_PER_DAY}`);
console.log(`   - Requests/sesión: ${LIMITS.REQUESTS_PER_SESSION}`);
console.log(`   - Costo máximo/día: $${LIMITS.COST_PER_DAY_USD} USD`);

