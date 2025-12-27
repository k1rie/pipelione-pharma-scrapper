import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HUBSPOT_KEY = process.env.HUBSPOT_TOKEN || process.env.HUBSPOT_KEY;
const COMPANIES_SEGMENT_ID = '7215';

async function resetScrapeDates() {
  try {
    console.log('🔄 Reseteando fechas de scraping...\n');
    
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
    
    console.log(`📋 Encontradas ${companyIds.length} empresas\n`);
    
    // Dividir en chunks de 100
    const chunkSize = 100;
    let updated = 0;
    
    for (let i = 0; i < companyIds.length; i += chunkSize) {
      const chunk = companyIds.slice(i, i + chunkSize);
      
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
                last_pipeline_scrape: null
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
          console.log(`  ✓ ${company.properties.name}`);
        } catch (error) {
          console.error(`  ❌ Error actualizando ${company.properties.name}:`, error.response?.data?.message || error.message);
        }
      }
    }
    
    console.log(`\n✅ ${updated} empresas actualizadas`);
    console.log('🔄 Todas las empresas están listas para scraping desde cero\n');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

resetScrapeDates();

