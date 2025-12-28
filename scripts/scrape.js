import dotenv from 'dotenv';
dotenv.config();

import { getCompaniesToScrape, updateCompanyLastScrape, saveMedications, publishChanges } from '../services/hubspotService.js';
import { findPipelineUrls } from '../services/searchService.js';
import { smartScrape } from '../services/playwrightService.js';
import { scrapeWebsite } from '../services/scraperService.js';
import { extractPipelineData } from '../services/openaiService.js';

/**
 * Script principal de scraping
 */
async function main() {
  try {
    console.log('🚀 Iniciando scraping de pipelines farmacéuticos\n');
    
    // 1. Obtener empresas que necesitan scraping (>3 meses)
    const companies = await getCompaniesToScrape();
    
    if (companies.length === 0) {
      console.log('⚠️  No hay empresas para procesar');
      return;
    }
    
    console.log(`\n📋 Procesando ${companies.length} empresa(s)...\n`);
    
    // 2. Procesar cada empresa
    for (const company of companies) {
      console.log(`\n🏢 Procesando: ${company.name}`);
      
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
            console.log(`  🤖 Extrayendo datos...`);
            
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
        
        // 3. Guardar medicamentos de esta empresa inmediatamente
        const medicationsFound = companyMedications.length > 0;
        
        if (medicationsFound) {
          console.log(`\n  💾 Guardando ${companyMedications.length} medicamentos de ${company.name}...`);
          
          // Guardar en HubSpot
          await saveMedications(companyMedications);
          await publishChanges();
          console.log(`  ✅ Medicamentos guardados en HubSpot`);
        } else {
          console.log(`\n  ℹ️  No se encontraron medicamentos para ${company.name}`);
        }
        
        // 4. Actualizar fecha de último scraping y estado de medicamentos encontrados
        await updateCompanyLastScrape(company.id, medicationsFound);
        console.log(`  📅 Fecha de scraping actualizada (Medicamentos encontrados: ${medicationsFound ? 'Sí' : 'No'})`);
        
      } catch (error) {
        console.error(`❌ Error procesando ${company.name}: ${error.message}`);
      }
    }
    
    console.log(`\n✨ Proceso completado exitosamente`);
    
  } catch (error) {
    console.error(`\n❌ Error fatal: ${error.message}`);
    process.exit(1);
  }
}

main();

