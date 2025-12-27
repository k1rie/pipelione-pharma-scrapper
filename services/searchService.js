import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

/**
 * Busca URLs de pipelines usando Google Search (scraping de resultados)
 * NO requiere API key, pero puede ser bloqueado
 */
export const searchPipelineUrlsWithGoogle = async (companyName) => {
  let browser = null;
  
  try {
    console.log(`  🔍 Buscando en Google con navegador: "${companyName} Pipeline"`);
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });
    
    const page = await context.newPage();
    
    // Ocultar webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    // Ir primero a Google home para establecer cookies
    console.log(`    🏠 Visitando Google home...`);
    await page.goto('https://www.google.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Ahora hacer la búsqueda
    const query = `${companyName} Pipeline`;
    console.log(`    🔍 Buscando: "${query}"`);
    
    // Usar el input de búsqueda como un humano
    await page.type('textarea[name="q"], input[name="q"]', query, { delay: 100 });
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Extraer URLs de los resultados
    const urls = await page.evaluate((companyName) => {
      const allUrls = new Set();
      const lowerCompany = companyName.toLowerCase();
      
      // Buscar en todos los links de resultados
      const links = document.querySelectorAll('a[href]');
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        
        // Extraer URL de /url?q=
        if (href && href.includes('/url?q=')) {
          try {
            const url = decodeURIComponent(href.split('/url?q=')[1].split('&')[0]);
            if (url.startsWith('http') && !url.includes('google.com')) {
              // Verificar que sea del dominio de la empresa
              const domain = url.split('/')[2]?.toLowerCase() || '';
              if (domain.includes(lowerCompany.split(' ')[0]) || lowerCompany.split(' ')[0].includes(domain.split('.')[0])) {
                allUrls.add(url);
              }
            }
          } catch (e) {}
        }
        
        // URLs directas
        if (href && href.startsWith('http') && !href.includes('google.com')) {
          const domain = href.split('/')[2]?.toLowerCase() || '';
          if (domain.includes(lowerCompany.split(' ')[0]) || lowerCompany.split(' ')[0].includes(domain.split('.')[0])) {
            allUrls.add(href);
          }
        }
      });
      
      return Array.from(allUrls).slice(0, 10);
    }, companyName);
    
    await browser.close();
    
    console.log(`  ✅ Encontradas ${urls.length} URLs en Google`);
    urls.forEach((url, i) => console.log(`     ${i + 1}. ${url}`));
    
    return urls;
    
  } catch (error) {
    if (browser) await browser.close();
    console.error(`  ❌ Error en Google: ${error.message}`);
    return [];
  }
};

/**
 * Busca URLs usando DuckDuckGo (más permisivo que Google)
 */
export const searchPipelineUrlsWithDuckDuckGo = async (companyName) => {
  let browser = null;
  
  try {
    console.log(`  🦆 Buscando en DuckDuckGo con navegador: "${companyName} Pipeline"`);
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });
    
    const page = await context.newPage();
    
    // Ocultar webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    const query = `${companyName} Pipeline`;
    
    // Usar DuckDuckGo normal (no HTML)
    console.log(`    🌐 Navegando a DuckDuckGo...`);
    await page.goto('https://duckduckgo.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Buscar como humano
    console.log(`    ⌨️  Escribiendo: "${query}"`);
    await page.type('input[name="q"]', query, { delay: 100 });
    await page.keyboard.press('Enter');
    console.log(`    ⏳ Esperando resultados...`);
    await page.waitForTimeout(5000); // Esperar resultados
    
    const urls = await page.evaluate((companyName) => {
      const allUrls = new Set();
      const lowerCompany = companyName.toLowerCase().split(' ')[0];
      
      // Buscar en todos los links de resultados
      const links = document.querySelectorAll('a[href], article a, .result a');
      
      console.log('Total links encontrados:', links.length);
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent || '';
        
        console.log('Link:', href, 'Text:', text.substring(0, 50));
        
        if (href && href.startsWith('http') && !href.includes('duckduckgo.com')) {
          try {
            const url = new URL(href);
            const domain = url.hostname.toLowerCase();
            
            // Verificar si el dominio contiene el nombre de la empresa
            if (domain.includes(lowerCompany) || lowerCompany.includes(domain.split('.')[0])) {
              allUrls.add(href);
              console.log('✅ URL válida:', href);
            }
          } catch (e) {
            console.log('❌ URL inválida:', href);
          }
        }
      });
      
      return Array.from(allUrls).slice(0, 10);
    }, companyName);
    
    await browser.close();
    
    console.log(`  ✅ Encontradas ${urls.length} URLs en DuckDuckGo`);
    urls.forEach((url, i) => console.log(`     ${i + 1}. ${url}`));
    
    return urls;
    
  } catch (error) {
    if (browser) await browser.close();
    console.error(`  ❌ Error en DuckDuckGo: ${error.message}`);
    return [];
  }
};

/**
 * Genera URLs comunes basadas en la empresa
 */
export const generateCommonPipelineUrls = (companyName) => {
  console.log(`  🔧 Generando URLs comunes para: ${companyName}`);
  
  // Obtener dominio de la empresa
  const domain = getCompanyDomain(companyName);
  
  if (!domain) {
    console.log(`  ⚠️  No se pudo determinar el dominio para ${companyName}`);
    return [];
  }
  
  // Rutas comunes donde suelen estar los pipelines
  const commonPaths = [
    '/pipeline',
    '/drug-pipeline',
    '/products-pipeline',
    '/research-development/pipeline',
    '/research/pipeline',
    '/science/pipeline',
    '/science/drug-product-pipeline',
    '/innovation/pipeline',
    '/rd/pipeline',
    '/clinical-development',
    '/clinical-trials',
    '/research-and-development',
  ];
  
  const urls = commonPaths.map(path => `https://www.${domain}${path}`);
  
  console.log(`  ✅ Generadas ${urls.length} URLs potenciales`);
  return urls;
};

/**
 * Valida si una URL es relevante para pipelines farmacéuticos
 */
function isValidPipelineUrl(url, companyName) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http')) return false;
  
  // Excluir dominios no deseados
  const excludeDomains = [
    'google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 
    'youtube.com', 'wikipedia.org', 'instagram.com'
  ];
  
  if (excludeDomains.some(domain => url.includes(domain))) {
    return false;
  }
  
  const lowerUrl = url.toLowerCase();
  const companyWords = companyName.toLowerCase().split(' ');
  
  // Debe contener al menos una palabra de la empresa en el dominio
  const hasCompanyInDomain = companyWords.some(word => 
    word.length > 3 && lowerUrl.split('/')[2]?.includes(word)
  );
  
  if (!hasCompanyInDomain) return false;
  
  // Priorizar URLs con palabras clave de pipeline
  const pipelineKeywords = [
    'pipeline', 'clinical', 'research', 'development', 'drug', 
    'pharmaceutical', 'products', 'science', 'innovation', 'therapy'
  ];
  
  const hasKeyword = pipelineKeywords.some(kw => lowerUrl.includes(kw));
  
  // Aceptar si tiene empresa en dominio (aunque no tenga keyword)
  return true;
}

/**
 * Obtiene el dominio probable de una empresa
 */
function getCompanyDomain(companyName) {
  // Mapeo de empresas conocidas
  const knownDomains = {
    'pfizer': 'pfizer.com',
    'novartis': 'novartis.com',
    'roche': 'roche.com',
    'johnson & johnson': 'jnj.com',
    'merck': 'merck.com',
    'gsk': 'gsk.com',
    'glaxosmithkline': 'gsk.com',
    'astrazeneca': 'astrazeneca.com',
    'sanofi': 'sanofi.com',
    'bayer': 'bayer.com',
    'bristol myers squibb': 'bms.com',
    'bms': 'bms.com',
    'abbvie': 'abbvie.com',
    'amgen': 'amgen.com',
    'gilead': 'gilead.com',
    'eli lilly': 'lilly.com',
    'lilly': 'lilly.com',
    'boehringer ingelheim': 'boehringer-ingelheim.com',
    'takeda': 'takeda.com',
    'biogen': 'biogen.com',
    'regeneron': 'regeneron.com',
    'moderna': 'modernatx.com',
    'biontech': 'biontech.com',
  };
  
  const lowerName = companyName.toLowerCase();
  
  // Buscar coincidencia exacta
  if (knownDomains[lowerName]) {
    return knownDomains[lowerName];
  }
  
  // Buscar coincidencia parcial
  for (const [key, domain] of Object.entries(knownDomains)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return domain;
    }
  }
  
  // Si no se encuentra, intentar generar (empresa.com)
  const firstWord = companyName.toLowerCase().split(' ')[0];
  return `${firstWord}.com`;
}

/**
 * Estrategia combinada: intenta múltiples métodos
 */
export const findPipelineUrls = async (companyName) => {
  console.log(`\n  🔎 Buscando URLs para: ${companyName}`);
  
  let urls = [];
  
  // Método 1: DuckDuckGo (principal - no tiene captcha)
  try {
    const duckUrls = await searchPipelineUrlsWithDuckDuckGo(companyName);
    urls = urls.concat(duckUrls);
  } catch (error) {
    console.log(`  ⚠️  DuckDuckGo falló: ${error.message}`);
  }
  
  // Método 2: Google (desactivado por captcha, solo si DuckDuckGo falla completamente)
  // if (urls.length === 0) {
  //   try {
  //     const googleUrls = await searchPipelineUrlsWithGoogle(companyName);
  //     urls = urls.concat(googleUrls);
  //   } catch (error) {
  //     console.log(`  ⚠️  Google falló: ${error.message}`);
  //   }
  // }
  
  // Método 3: URLs comunes (fallback)
  if (urls.length < 2) {
    console.log(`  ℹ️  Pocas URLs encontradas, agregando URLs comunes...`);
    const commonUrls = generateCommonPipelineUrls(companyName);
    urls = urls.concat(commonUrls);
  }
  
  // Eliminar duplicados y limitar a 5
  const uniqueUrls = [...new Set(urls)].slice(0, 5);
  
  console.log(`\n  📊 Total de URLs a probar: ${uniqueUrls.length}`);
  uniqueUrls.forEach((url, i) => console.log(`     ${i + 1}. ${url}`));
  
  return uniqueUrls;
};

