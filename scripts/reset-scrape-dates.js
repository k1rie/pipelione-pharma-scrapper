import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HUBSPOT_KEY = process.env.HUBSPOT_TOKEN || process.env.HUBSPOT_KEY;
const COMPANIES_SEGMENT_ID = '7215';

async function resetScrapeDates() {
  try {
    console.log('🚀 Iniciando reseteo completo de propiedades de scraping...\n');

    // Mostrar confirmación
    console.log('⚠️  ATENCIÓN: Esta acción reseteará TODAS las empresas del segmento');
    console.log('   • last_pipeline_scrape: se pondrá en null (forzará rescraping)');
    console.log('   • medications_found_last_scrape: se pondrá en "No"');
    console.log('   Todas las empresas aparecerán como "necesitan scraping" inmediatamente.\n');

    // Obtener todas las empresas del segmento
    const segmentResponse = await axios.get(
      `https://api.hubapi.com/crm/v3/lists/${COMPANIES_SEGMENT_ID}/memberships`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_KEY}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit: 250
        }
      }
    );

    const companyIds = segmentResponse.data.results.map(item => item.recordId);

    if (companyIds.length === 0) {
      console.log('⚠️  No hay empresas en el segmento');
      return;
    }

    console.log(`📋 Encontradas ${companyIds.length} empresas para resetear\n`);

    // Dividir en chunks de 100
    const chunkSize = 100;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < companyIds.length; i += chunkSize) {
      const chunk = companyIds.slice(i, i + chunkSize);
      console.log(`🔄 Procesando lote ${Math.floor(i / chunkSize) + 1} de ${Math.ceil(companyIds.length / chunkSize)} (${chunk.length} empresas)...`);

      // Obtener nombres de empresas
      const batchResponse = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/companies/batch/read',
        {
          properties: ['name'],
          inputs: chunk.map(id => ({ id }))
        },
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );

      // Actualizar cada empresa
      for (const company of batchResponse.data.results) {
        try {
          await axios.patch(
            `https://api.hubapi.com/crm/v3/objects/companies/${company.id}`,
            {
              properties: {
                last_pipeline_scrape: null, // Resetear fecha para forzar rescraping
                medications_found_last_scrape: 'No' // Resetear estado de medicamentos
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${HUBSPOT_KEY}`,
                'Content-Type': 'application/json',
              }
            }
          );

          updated++;
          console.log(`  ✅ ${company.properties.name || `Empresa ${company.id}`}`);
        } catch (error) {
          errors++;
          console.error(`  ❌ Error actualizando ${company.properties.name || `Empresa ${company.id}`}:`, error.response?.data?.message || error.message);
        }
      }

      console.log(`  📊 Lote completado: ${updated} total actualizadas, ${errors} errores\n`);

      // Pequeña pausa entre lotes para no saturar API
      if (i + chunkSize < companyIds.length) {
        console.log('⏳ Esperando 2 segundos antes del siguiente lote...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎯 RESETEO COMPLETADO');
    console.log('='.repeat(50));
    console.log(`✅ Empresas reseteadas: ${updated}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📊 Total procesadas: ${companyIds.length}`);
    console.log('='.repeat(50));

    if (updated > 0) {
      console.log('\n💡 Ahora todas las empresas aparecerán como "necesitan scraping" en el próximo ciclo.');
      console.log('💡 El scheduler ejecutará scraping para todas las empresas independientemente de la fecha.');
    }

  } catch (error) {
    console.error('❌ Error fatal en el reseteo:', error.response?.data || error.message);
    process.exit(1);
  }
}

resetScrapeDates();

