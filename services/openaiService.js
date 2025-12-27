import OpenAI from 'openai';
import dotenv from 'dotenv';
import { canMakeRequest, trackRequest, waitIfNeeded, getUsageStats } from './openaiUsageTracker.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Obtiene links de pipelines farmacéuticos usando ChatGPT
 */
export const getPipelineLinks = async (companyName) => {
  try {
    // Verificar límites antes de hacer el request
    await waitIfNeeded();
    
    const check = canMakeRequest();
    if (!check.allowed) {
      const stats = getUsageStats();
      console.error(`\n⛔ Límite de OpenAI alcanzado: ${check.reason}`);
      console.log(`📊 Estadísticas actuales:`, stats);
      throw new Error(`Límite de OpenAI alcanzado: ${check.reason}`);
    }

    const prompt = `Necesito las URLs REALES y EXACTAS de las páginas de pipeline de la empresa farmacéutica "${companyName}".

IMPORTANTE:
- Proporciona SOLO URLs que REALMENTE EXISTEN en el sitio web oficial de ${companyName}
- Busca la URL EXACTA de su página de pipeline/productos en desarrollo/investigación clínica
- Si conoces la URL exacta del sitio oficial, proporciónala
- NO inventes URLs, solo proporciona las que SABES que existen
- Incluye URLs como: /pipeline, /research, /clinical-trials, /products-development, /drug-pipeline

FORMATO DE RESPUESTA:
- Una URL por línea
- Sin numeración, sin texto adicional
- SOLO las URLs
- Máximo 3 URLs

Ejemplo:
https://www.pfizer.com/science/drug-product-pipeline
https://www.pfizer.com/science/clinical-trials
https://www.pfizer.com/science/research-development`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Eres un experto en la industria farmacéutica con conocimiento actualizado de las páginas web oficiales de empresas farmacéuticas. SOLO proporcionas URLs reales que conoces que existen. Si no estás seguro de una URL exacta, proporciona la URL base de la empresa y las rutas comunes donde suelen estar los pipelines (/pipeline, /research-development, /clinical-trials)."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    // Registrar uso
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const usage = trackRequest(inputTokens, outputTokens);
    
    // Log de uso cada 10 requests
    if (usage.daily.requests % 10 === 0) {
      const stats = getUsageStats();
      console.log(`\n📊 Uso de OpenAI: ${stats.daily.requests}/${stats.daily.limit} requests diarios | $${stats.daily.estimatedCost.toFixed(4)} USD`);
    }

    const response = completion.choices[0].message.content.trim();
    console.log(`  📝 Respuesta de ChatGPT:\n${response}`);
    
    // Extraer URLs del texto
    const urlRegex = /https?:\/\/[^\s]+/g;
    const links = response.match(urlRegex) || [];
    
    // Limpiar y validar URLs
    const cleanLinks = links
      .map(link => link.replace(/[,.]$/, '')) // Remover puntuación al final
      .map(link => link.replace(/\)$/, '')) // Remover paréntesis al final
      .filter(link => link.startsWith('http'))
      .slice(0, 3); // Máximo 3 links

    console.log(`  🔗 URLs extraídas: ${cleanLinks.length}`);
    cleanLinks.forEach((link, i) => console.log(`     ${i + 1}. ${link}`));

    if (cleanLinks.length === 0) {
      throw new Error(`No se encontraron URLs válidas para ${companyName}. ChatGPT respondió: "${response}"`);
    }

    return cleanLinks;

  } catch (error) {
    console.error('❌ Error obteniendo links de ChatGPT:', error.message);
    
    // Si es error de API key
    if (error.message.includes('API key') || error.message.includes('authentication')) {
      throw new Error(`Error de autenticación con OpenAI. Verifica tu API key en el archivo .env`);
    }
    
    // Si es error de rate limit
    if (error.message.includes('rate limit')) {
      throw new Error(`Has excedido el límite de peticiones de OpenAI. Espera unos minutos e intenta de nuevo.`);
    }
    
    throw new Error(`Error al obtener links para ${companyName}: ${error.message}`);
  }
};

/**
 * Extrae datos del pipeline usando ChatGPT
 */
export const extractPipelineData = async (websiteContent, url) => {
  try {
    // Verificar límites antes de hacer el request
    await waitIfNeeded();
    
    const check = canMakeRequest();
    if (!check.allowed) {
      const stats = getUsageStats();
      console.error(`\n⛔ Límite de OpenAI alcanzado: ${check.reason}`);
      console.log(`📊 Estadísticas actuales:`, stats);
      throw new Error(`Límite de OpenAI alcanzado: ${check.reason}`);
    }

    // Limitar el contenido pero tomar más caracteres para mejor contexto
    const maxLength = parseInt(process.env.SCRAPING_MAX_CONTENT_LENGTH) || 20000;
    const truncatedContent = websiteContent.substring(0, maxLength);

    const prompt = `Analiza este contenido de PIPELINE FARMACÉUTICO y extrae SOLO medicamentos/moléculas en desarrollo clínico.

CONTENIDO:
${truncatedContent}

QUÉ EXTRAER:
✅ SÍ extraer:
- Medicamentos/fármacos (ej: "Pembrolizumab", "Keytruda")
- Moléculas/compuestos (ej: "PF-07321332", "BNT162b2")
- Terapias biológicas (anticuerpos, vacunas terapéuticas)
- Terapias génicas o celulares
- Medicamentos veterinarios
- Cualquier producto en DESARROLLO CLÍNICO (Fase I/II/III) o aprobado

❌ NO extraer:
- Productos cosméticos (maquillaje, cremas, perfumes)
- Productos de higiene personal (shampoo, jabón, desodorante)
- Suplementos alimenticios o nutricionales
- Dispositivos médicos
- Productos de consumo masivo

CAMPOS:
- molecula: nombre del medicamento/molécula (ej: "Paxlovid", "Comirnaty")
- area_terapeutica: una de estas opciones (elige la más cercana):
  Cardiology, Neumology, Oncologia, Vacunas, Inflamación e Inmunología, Medicina interna,
  Inmunologia, Neurología, Enfermedades raras, Cáncer, Salud cardiometabolica, Neurociencia,
  Otras especialidades, Cuidado ocular, Respiratorio, Metabolico, infectología, oftalmología,
  antiviral, Nefrología, Hematología, Diabetes, Salud ocular, Medicina genetica, Salud femenina,
  Cuidados intensivos, Hepatología, Endocrinología, Varios, Neuromuscular, Gastrointestinal,
  Salud ósea, Dolor, Medicina reproductiva, Urología, Salud materna, Gastroenterología,
  Alergias, Autoinmune, Salud articular, Animal, Anticoagulante, VIH, Depresión, Hiperplasia,
  Psiquiatría, Dermatología
- fase_cofepris: una de estas opciones (elige la más cercana):
  1, 2, 3, Filed, Approved, Registration, Ilegal, Submission, Comercializado, Preclínica

CONVERSIONES:
- "Fase I/Phase I"→"1", "Fase II/Phase II"→"2", "Fase III/Phase III"→"3"
- "Aprobado/Approved/Marketed"→"Approved"
- "Registro"→"Registration"
- "Preclínico/Preclinical"→"Preclínica"

REGLAS:
1. Extrae TODOS los medicamentos farmacéuticos encontrados
2. IGNORA productos cosméticos, de higiene o suplementos
3. Si la página NO es de pipeline farmacéutico, devuelve: {"productos": []}
4. NO inventes datos
5. SOLO JSON, sin texto adicional

JSON:
{
  "productos": [
    {
      "molecula": "nombre",
      "area_terapeutica": "opción de la lista",
      "fase_cofepris": "opción de la lista"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Experto en extraer datos de pipelines farmacéuticos. Extraes TODOS los productos sin importar formato, estructura o presentación. JSON válido siempre."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    // Registrar uso
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const usage = trackRequest(inputTokens, outputTokens);
    
    // Log de uso cada 10 requests
    if (usage.daily.requests % 10 === 0) {
      const stats = getUsageStats();
      console.log(`\n📊 Uso de OpenAI: ${stats.daily.requests}/${stats.daily.limit} requests diarios | $${stats.daily.estimatedCost.toFixed(4)} USD`);
    }

    const response = completion.choices[0].message.content.trim();
    const data = JSON.parse(response);

    return data;

  } catch (error) {
    console.error('Error extrayendo datos con ChatGPT:', error);
    
    // Si es error de límite, no relanzar el error original
    if (error.message.includes('Límite de OpenAI alcanzado')) {
      throw error;
    }
    
    throw new Error(`Error al extraer datos: ${error.message}`);
  }
};

/**
 * Obtiene estadísticas de uso de OpenAI
 */
export const getOpenAIUsageStats = () => {
  return getUsageStats();
};

