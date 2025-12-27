import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Descarga y extrae el contenido de texto de una página web
 */
export const scrapeWebsite = async (url) => {
  try {
    console.log(`    🌐 Conectando a: ${url}`);
    
    // Configurar headers para simular un navegador
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: process.env.SCRAPING_TIMEOUT || 15000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400, // Acepta redirects
    });

    console.log(`    ✅ Conectado (Status: ${response.status})`);
    
    const html = response.data;
    const $ = cheerio.load(html);

    // Remover scripts, estilos y otros elementos no deseados
    $('script').remove();
    $('style').remove();
    $('nav').remove();
    $('footer').remove();
    $('header').remove();
    $('.cookie-banner').remove();
    $('.advertisement').remove();
    $('iframe').remove();

    // Extraer texto del body
    const text = $('body')
      .text()
      .replace(/\s+/g, ' ') // Reemplazar múltiples espacios por uno
      .replace(/\n+/g, '\n') // Limpiar múltiples saltos de línea
      .trim();

    console.log(`    📄 Contenido extraído: ${text.length} caracteres`);

    if (!text || text.length < 100) {
      throw new Error(`El contenido extraído es demasiado corto (${text.length} caracteres). La página puede estar protegida o ser dinámica.`);
    }

    return text;

  } catch (error) {
    // Errores de red
    if (error.code === 'ENOTFOUND') {
      throw new Error(`❌ Dominio no encontrado: ${url}. Verifica que la URL sea correcta.`);
    } 
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`⏱️ Timeout: La página tardó más de 15 segundos en responder: ${url}`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`🚫 Conexión rechazada: ${url}. El servidor no está disponible.`);
    }
    
    // Errores HTTP
    if (error.response) {
      const status = error.response.status;
      
      if (status === 403) {
        throw new Error(`🚫 Acceso prohibido (403): ${url}. La página puede tener protección anti-scraping.`);
      }
      
      if (status === 404) {
        throw new Error(`❌ Página no encontrada (404): ${url}. La URL puede ser incorrecta o la página fue eliminada.`);
      }
      
      if (status === 429) {
        throw new Error(`⏸️ Demasiadas peticiones (429): ${url}. Espera unos minutos antes de intentar de nuevo.`);
      }
      
      if (status >= 500) {
        throw new Error(`⚠️ Error del servidor (${status}): ${url}. El servidor está teniendo problemas.`);
      }
      
      throw new Error(`❌ Error HTTP ${status}: ${url}`);
    }
    
    // Otros errores
    throw new Error(`❌ Error scrapeando ${url}: ${error.message}`);
  }
};

