import { extractPipelineData } from '../services/openaiService.js';
import { scrapeWebsite } from '../services/scraperService.js';
import { findPipelineUrls } from '../services/searchService.js';
import { smartScrape } from '../services/playwrightService.js';

export const scrapePipelines = async (req, res) => {
  try {
    const { companies } = req.body;

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de nombres de empresas' 
      });
    }

    console.log(`📋 Procesando ${companies.length} empresa(s)...`);

    const results = [];

    for (const company of companies) {
      console.log(`\n🏢 Procesando: ${company}`);
      
      try {
        // Paso 1: Buscar links REALES en internet (Google/DuckDuckGo)
        console.log(`  🔍 Buscando links REALES de pipelines en internet...`);
        const links = await findPipelineUrls(company);
        
        if (!links || links.length === 0) {
          throw new Error(`No se encontraron URLs para ${company}`);
        }
        
        console.log(`  ✅ Encontrados ${links.length} links para probar`);

        const companyResults = {
          company,
          pipelines: []
        };

        // Paso 2: Por cada link, scraper y extraer datos
        let successfulScrapes = 0;
        const maxSuccessful = 5; // Máximo 5 URLs exitosas por empresa
        
        for (const link of links) {
          if (successfulScrapes >= maxSuccessful) {
            console.log(`  ℹ️  Ya se procesaron ${maxSuccessful} URLs exitosas, omitiendo el resto`);
            break;
          }
          
          console.log(`\n  🌐 Probando URL: ${link}`);
          
          try {
            // Usar scraping inteligente: primero rápido, luego Puppeteer si es necesario
            const websiteContent = await smartScrape(link, scrapeWebsite);
            console.log(`  📄 Contenido obtenido (${websiteContent.length} caracteres)`);

            // Paso 3: Extraer datos con ChatGPT
            console.log(`  🤖 Extrayendo datos con ChatGPT...`);
            const pipelineData = await extractPipelineData(websiteContent, link);
            
            companyResults.pipelines.push({
              url: link,
              ...pipelineData
            });

            successfulScrapes++;
            console.log(`  ✅ Datos extraídos exitosamente (${successfulScrapes}/${maxSuccessful})`);
            
          } catch (error) {
            console.error(`  ❌ Error con ${link}: ${error.message}`);
            // No agregar a resultados si falla, continuar con siguiente URL
          }
        }
        
        // Si no se pudo scrapear ninguna URL
        if (successfulScrapes === 0) {
          throw new Error(`No se pudo acceder a ninguna URL de pipeline para ${company}`);
        }

        results.push(companyResults);

      } catch (error) {
        console.error(`❌ Error procesando ${company}:`, error.message);
        results.push({
          company,
          error: error.message
        });
      }
    }

    console.log(`\n✨ Proceso completado`);
    res.json({ 
      success: true, 
      results 
    });

  } catch (error) {
    console.error('❌ Error general:', error);
    res.status(500).json({ 
      error: 'Error procesando la solicitud',
      details: error.message 
    });
  }
};

