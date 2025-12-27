import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import scraperRoutes from './routes/scraper.js';
import { getCompaniesToScrape, updateCompanyLastScrape, saveMedications, publishChanges } from './services/hubspotService.js';
import { findPipelineUrls } from './services/searchService.js';
import { smartScrape } from './services/playwrightService.js';
import { scrapeWebsite } from './services/scraperService.js';
import { extractPipelineData } from './services/openaiService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/scraper', scraperRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Pharma Pipeline Scraper API' });
});

// Función de scraping automático
async function runAutomaticScraping() {
  try {
    console.log('\n🤖 ========================================');
    console.log('🤖 INICIANDO SCRAPING AUTOMÁTICO');
    console.log('🤖 ========================================\n');
    
    // 1. Obtener empresas que necesitan scraping (>3 meses)
    const companies = await getCompaniesToScrape();
    
    if (companies.length === 0) {
      console.log('⚠️  No hay empresas para procesar (todas fueron scrapeadas recientemente)');
      return;
    }
    
    console.log(`\n📋 Procesando ${companies.length} empresa(s)...\n`);
    
    // 2. Procesar cada empresa
    for (const company of companies) {
      console.log(`\n🏢 ======== Procesando: ${company.name} ========`);
      
      const companyMedications = [];
      
      try {
        // Buscar URLs
        const links = await findPipelineUrls(company.name);
        
        if (!links || links.length === 0) {
          console.log(`  ⚠️  No se encontraron URLs para ${company.name}`);
          continue;
        }
        
        console.log(`  ✅ Encontradas ${links.length} URLs`);
        
        // Procesar URLs
        let successfulScrapes = 0;
        const maxSuccessful = 5;
        
        for (const link of links) {
          if (successfulScrapes >= maxSuccessful) break;
          
          console.log(`\n  🌐 Probando: ${link}`);
          
          try {
            const content = await smartScrape(link, scrapeWebsite);
            
            if (content.length < 100) {
              console.log(`  ⚠️  Contenido muy corto, saltando...`);
              continue;
            }
            
            console.log(`  📄 Contenido: ${content.length} caracteres`);
            console.log(`  🤖 Extrayendo datos con OpenAI...`);
            
            const pipelineData = await extractPipelineData(content, link);
            
            if (pipelineData.productos && pipelineData.productos.length > 0) {
              // Agregar nombre de empresa a cada medicamento
              const medicationsWithCompany = pipelineData.productos.map(med => ({
                ...med,
                empresa: company.name
              }));
              
              companyMedications.push(...medicationsWithCompany);
              successfulScrapes++;
              console.log(`  ✅ ${pipelineData.productos.length} medicamentos extraídos (${successfulScrapes}/${maxSuccessful})`);
            } else {
              console.log(`  ℹ️  No se encontraron medicamentos`);
            }
            
          } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
          }
        }
        
        // 3. Guardar medicamentos de esta empresa
        if (companyMedications.length > 0) {
          console.log(`\n  💾 Guardando ${companyMedications.length} medicamentos de ${company.name}...`);
          
          await saveMedications(companyMedications);
          await publishChanges();
          console.log(`  ✅ Medicamentos guardados en HubSpot`);
        }
        
        // 4. Actualizar fecha de último scraping
        await updateCompanyLastScrape(company.id);
        console.log(`  📅 Fecha de scraping actualizada`);
        
      } catch (error) {
        console.error(`❌ Error procesando ${company.name}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 ========================================');
    console.log('🎉 SCRAPING AUTOMÁTICO COMPLETADO');
    console.log('🎉 ========================================\n');
    
  } catch (error) {
    console.error(`\n❌ Error en scraping automático: ${error.message}`);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Iniciar scraping automático después de que el servidor esté listo
  console.log('⏳ Esperando 5 segundos antes de iniciar scraping automático...');
  setTimeout(async () => {
    await runAutomaticScraping();
  }, 5000); // Esperar 5 segundos para que el servidor esté completamente listo
});

