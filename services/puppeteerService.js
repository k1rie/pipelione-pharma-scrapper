import puppeteer from 'puppeteer';
import fs from 'fs';

// Detectar Chrome instalado
function getChromePath() {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  
  return null;
}

/**
 * Scraper con Puppeteer - Renderiza JavaScript y obtiene contenido dinámico
 * Usa un navegador real para cargar páginas con JavaScript
 */
export const scrapeWithPuppeteer = async (url) => {
  let browser = null;
  
  try {
    console.log(`    🤖 Iniciando navegador Puppeteer para: ${url}`);
    
    const chromePath = getChromePath();
    const launchOptions = {
      headless: process.env.NODE_ENV === 'production' ? 'new' : false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      defaultViewport: null,
    };
    
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }
    
    browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    
    // Ocultar webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    // Configurar viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // User-Agent realista
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Headers adicionales
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    // Bloquear recursos innecesarios para acelerar
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    console.log(`    🌐 Navegando a: ${url}`);
    
    // Navegar a la URL con timeout
    await page.goto(url, {
      waitUntil: 'networkidle2', // Esperar a que la red esté inactiva
      timeout: 30000, // 30 segundos
    });
    
    console.log(`    ⏳ Esperando que JavaScript cargue el contenido...`);
    
    // Esperar un poco más para que JavaScript termine de renderizar
    await page.waitForTimeout(3000); // 3 segundos adicionales
    
    // Intentar esperar por selectores comunes de tablas de pipelines
    try {
      await Promise.race([
        page.waitForSelector('table', { timeout: 5000 }),
        page.waitForSelector('.pipeline', { timeout: 5000 }),
        page.waitForSelector('[class*="pipeline"]', { timeout: 5000 }),
        page.waitForSelector('[id*="pipeline"]', { timeout: 5000 }),
      ]);
      console.log(`    ✅ Contenido de pipeline detectado`);
    } catch (e) {
      console.log(`    ℹ️  No se detectó selector específico de pipeline, continuando...`);
    }
    
    // Extraer contenido de múltiples formas para capturar todo
    const extractedData = await page.evaluate(() => {
      // Remover elementos no deseados
      const unwanted = ['script', 'style', 'nav', 'header', 'footer', '[class*="cookie"]', '[class*="banner"]', '[class*="ad"]'];
      unwanted.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
      
      const results = [];
      
      // 1. Texto general del body
      results.push('=== CONTENIDO GENERAL ===');
      results.push(document.body.innerText);
      
      // 2. Tablas (formato estructurado)
      const tables = Array.from(document.querySelectorAll('table'));
      if (tables.length > 0) {
        results.push('\n=== TABLAS ===');
        tables.forEach((table, idx) => {
          results.push(`\nTabla ${idx + 1}:`);
          const rows = Array.from(table.querySelectorAll('tr'));
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            if (cells.length > 0) {
              results.push(cells.map(c => c.innerText.trim()).join(' | '));
            }
          });
        });
      }
      
      // 3. Listas (ul, ol)
      const lists = Array.from(document.querySelectorAll('ul, ol'));
      if (lists.length > 0) {
        results.push('\n=== LISTAS ===');
        lists.forEach(list => {
          const items = Array.from(list.querySelectorAll('li'));
          items.forEach(item => results.push('- ' + item.innerText.trim()));
        });
      }
      
      // 4. Divs con clases relacionadas a pipeline
      const pipelineDivs = Array.from(document.querySelectorAll('[class*="pipeline"], [class*="product"], [class*="drug"], [id*="pipeline"]'));
      if (pipelineDivs.length > 0) {
        results.push('\n=== SECCIONES DE PIPELINE ===');
        pipelineDivs.forEach(div => {
          const text = div.innerText.trim();
          if (text.length > 20 && text.length < 5000) {
            results.push(text);
          }
        });
      }
      
      return results.join('\n');
    });
    
    let fullContent = extractedData;
    
    console.log(`    📄 Contenido extraído: ${fullContent.length} caracteres`);
    
    if (!fullContent || fullContent.length < 100) {
      await browser.close();
      throw new Error(`El contenido extraído es muy corto (${fullContent.length} caracteres). La página puede estar protegida.`);
    }
    
    // Esperar 2 segundos para que puedas ver el resultado
    await page.waitForTimeout(2000);
    
    await browser.close();
    
    return fullContent;
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    // Errores específicos
    if (error.message.includes('timeout')) {
      throw new Error(`⏱️ Timeout: La página tardó más de 30 segundos en cargar: ${url}`);
    }
    
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      throw new Error(`❌ Dominio no encontrado: ${url}`);
    }
    
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      throw new Error(`🚫 Conexión rechazada: ${url}`);
    }
    
    throw new Error(`❌ Error con Puppeteer en ${url}: ${error.message}`);
  }
};

/**
 * Scraper inteligente: intenta primero con Axios/Cheerio (rápido),
 * si falla o el contenido es muy corto, usa Puppeteer (lento pero completo)
 */
export const smartScrape = async (url, axiosScraper) => {
  console.log(`    🧠 Scraping inteligente: ${url}`);
  
  try {
    // Intento 1: Axios/Cheerio (rápido)
    console.log(`    ⚡ Axios/Cheerio...`);
    const content = await axiosScraper(url);
    
    // Si tiene suficiente contenido, usar
    if (content.length > 2000) {
      console.log(`    ✅ Axios OK (${content.length} chars)`);
      return content;
    }
    console.log(`    ⚠️  Poco contenido (${content.length}), usando Puppeteer...`);
  } catch (error) {
    console.log(`    ⚠️  Axios falló, usando Puppeteer...`);
  }
  
  // Intento 2: Puppeteer (completo)
  const content = await scrapeWithPuppeteer(url);
  console.log(`    ✅ Puppeteer OK (${content.length} chars)`);
  return content;
};

/**
 * Scraper específico para tablas de pipelines
 * Extrae datos estructurados de tablas HTML
 */
export const extractPipelineTables = async (url) => {
  let browser = null;
  
  try {
    console.log(`    📊 Extrayendo tablas de pipeline de: ${url}`);
    
    const chromePath = getChromePath();
    const launchOptions = {
      headless: process.env.NODE_ENV === 'production' ? 'new' : false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      defaultViewport: null,
    };
    
    if (chromePath) launchOptions.executablePath = chromePath;
    
    browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Extraer tablas estructuradas
    const pipelineData = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      const results = [];
      
      tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => 
          th.innerText.trim().toLowerCase()
        );
        
        // Verificar si es una tabla de pipeline (contiene palabras clave)
        const isPipelineTable = headers.some(h => 
          h.includes('drug') || 
          h.includes('molecule') || 
          h.includes('compound') ||
          h.includes('product') ||
          h.includes('phase') ||
          h.includes('indication') ||
          h.includes('therapeutic')
        );
        
        if (isPipelineTable) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td')).map(td => 
              td.innerText.trim()
            );
            
            if (cells.length > 0) {
              const rowData = {};
              headers.forEach((header, i) => {
                if (cells[i]) {
                  rowData[header] = cells[i];
                }
              });
              results.push(rowData);
            }
          });
        }
      });
      
      return results;
    });
    
    await browser.close();
    
    console.log(`    ✅ Extraídas ${pipelineData.length} filas de tablas`);
    
    return pipelineData;
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
};

