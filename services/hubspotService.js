import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HUBSPOT_KEY = process.env.HUBSPOT_TOKEN || process.env.HUBSPOT_KEY;

// Segmento de empresas: 7215
const COMPANIES_SEGMENT_ID = '7215';

// DB de resultados: 146541853
const RESULTS_TABLE_ID = '146541853';

/**
 * Obtiene todas las empresas del segmento de HubSpot
 */
export const getCompaniesToScrape = async () => {
  try {
    console.log('📊 Obteniendo empresas del segmento HubSpot...');
    
    // Primero obtener los IDs de empresas del segmento
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
      return [];
    }
    
    console.log(`  📋 ${companyIds.length} empresas en el segmento`);
    
    // Dividir en chunks de 100 (límite de batch API)
    const chunkSize = 100;
    const allCompanies = [];
    
    for (let i = 0; i < companyIds.length; i += chunkSize) {
      const chunk = companyIds.slice(i, i + chunkSize);
      
      const batchResponse = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/companies/batch/read',
        {
          properties: ['name', 'last_pipeline_scrape'],
          inputs: chunk.map(id => ({ id }))
        },
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      const companies = batchResponse.data.results
        .filter(company => company.properties?.name)
        .map(company => ({
          id: company.id,
          name: company.properties.name,
          lastUpdated: company.properties?.last_pipeline_scrape || null
        }));
      
      allCompanies.push(...companies);
    }
    
    // Filtrar empresas que necesitan scraping (>3 meses o nunca scrapeadas)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const companiesToScrape = allCompanies.filter(company => {
      if (!company.lastUpdated) {
        console.log(`  📅 ${company.name}: Nunca scrapeada`);
        return true;
      }
      
      const lastUpdatedDate = new Date(company.lastUpdated);
      if (lastUpdatedDate < threeMonthsAgo) {
        const daysSince = Math.floor((new Date() - lastUpdatedDate) / (24 * 60 * 60 * 1000));
        console.log(`  📅 ${company.name}: Última actualización hace ${daysSince} días`);
        return true;
      }
      
      return false;
    });
    
    console.log(`✅ ${companiesToScrape.length} de ${allCompanies.length} empresas necesitan scraping`);
    
    return companiesToScrape;
  } catch (error) {
    console.error('❌ Error obteniendo empresas:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Crea la propiedad custom para tracking de scraping si no existe
 */
async function ensureScrapingProperty() {
  try {
    // Intentar obtener la propiedad
    await axios.get(
      'https://api.hubapi.com/crm/v3/properties/companies/last_pipeline_scrape',
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return true; // Ya existe
  } catch (error) {
    if (error.response?.status === 404) {
      // Crear la propiedad
      console.log('📝 Creando propiedad custom: last_pipeline_scrape');
      
      try {
        await axios.post(
          'https://api.hubapi.com/crm/v3/properties/companies',
          {
            name: 'last_pipeline_scrape',
            label: 'Last Pipeline Scrape',
            type: 'date',
            fieldType: 'date',
            groupName: 'companyinformation',
            description: 'Fecha del último scraping de pipeline farmacéutico'
          },
          {
            headers: {
              'Authorization': `Bearer ${HUBSPOT_KEY}`,
              'Content-Type': 'application/json',
            }
          }
        );
        
        console.log('✅ Propiedad creada exitosamente');
        return true;
      } catch (createError) {
        console.error('❌ Error creando propiedad:', createError.response?.data || createError.message);
        return false;
      }
    }
    
    console.error('❌ Error verificando propiedad:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Crea la propiedad custom para tracking de medicamentos encontrados si no existe
 */
async function ensureMedicationsFoundProperty() {
  try {
    // Intentar obtener la propiedad
    await axios.get(
      'https://api.hubapi.com/crm/v3/properties/companies/medications_found_last_scrape',
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return true; // Ya existe
  } catch (error) {
    if (error.response?.status === 404) {
      // Crear la propiedad
      console.log('📝 Creando propiedad custom: medications_found_last_scrape');
      
      try {
        await axios.post(
          'https://api.hubapi.com/crm/v3/properties/companies',
          {
            name: 'medications_found_last_scrape',
            label: 'Medications Found Last Scrape',
            type: 'string',
            fieldType: 'text',
            groupName: 'companyinformation',
            description: 'Indica si se encontraron medicamentos en el último scraping (Yes/No)'
          },
          {
            headers: {
              'Authorization': `Bearer ${HUBSPOT_KEY}`,
              'Content-Type': 'application/json',
            }
          }
        );
        
        console.log('✅ Propiedad medications_found_last_scrape creada exitosamente');
        return true;
      } catch (createError) {
        console.error('❌ Error creando propiedad medications_found:', createError.response?.data || createError.message);
        return false;
      }
    }
    
    console.error('❌ Error verificando propiedad medications_found:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Actualiza la fecha de último scraping de una empresa y si se encontraron medicamentos
 */
export const updateCompanyLastScrape = async (companyId, medicationsFound = false) => {
  try {
    // Asegurar que las propiedades existen
    await ensureScrapingProperty();
    await ensureMedicationsFoundProperty();
    
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/companies/${companyId}`,
      {
        properties: {
          last_pipeline_scrape: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
          medications_found_last_scrape: medicationsFound ? 'Yes' : 'No'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('❌ Error actualizando fecha:', error.response?.data || error.message);
    return false;
  }
};

/**
 * Busca un medicamento existente por nombre en HubSpot DB
 */
async function findExistingMedication(moleculeName) {
  try {
    const response = await axios.get(
      `https://api.hubapi.com/cms/v3/hubdb/tables/${RESULTS_TABLE_ID}/rows`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    const existing = response.data.results.find(row => 
      row.values?.molecula?.toLowerCase() === moleculeName.toLowerCase()
    );
    
    return existing || null;
  } catch (error) {
    console.error(`❌ Error buscando medicamento:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Guarda o actualiza un medicamento en HubSpot DB
 */
export const saveMedication = async (medication) => {
  try {
    const moleculeName = String(medication.molecula || '').trim();
    
    // Buscar si ya existe
    const existing = await findExistingMedication(moleculeName);
    
    if (existing) {
      // Actualizar solo la fase
      console.log(`  🔄 Actualizando fase de: ${moleculeName}`);
      
      await axios.patch(
        `https://api.hubapi.com/cms/v3/hubdb/tables/${RESULTS_TABLE_ID}/rows/${existing.id}`,
        {
          values: {
            fase_cofepris: String(medication.fase_cofepris || '').trim()
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      return true;
    }
    
    // Crear nuevo
    const rowData = {
      values: {
        molecula: moleculeName,
        area_terapeutica: String(medication.area_terapeutica || '').trim(),
        fase_cofepris: String(medication.fase_cofepris || '').trim(),
        empresa: String(medication.empresa || '').trim(),
      }
    };
    
    await axios.post(
      `https://api.hubapi.com/cms/v3/hubdb/tables/${RESULTS_TABLE_ID}/rows`,
      rowData,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error(`❌ Error guardando medicamento:`, error.response?.data || error.message);
    return false;
  }
};

/**
 * Guarda múltiples medicamentos en batch
 */
export const saveMedications = async (medications) => {
  console.log(`💾 Guardando ${medications.length} medicamentos en HubSpot...`);
  
  let success = 0;
  let failed = 0;
  
  for (const med of medications) {
    const result = await saveMedication(med);
    if (result) {
      success++;
    } else {
      failed++;
    }
    
    // Pequeño delay para no saturar API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ Guardados: ${success}, ❌ Fallidos: ${failed}`);
  
  return { success, failed };
};

/**
 * Publica los cambios en HubSpot
 */
export const publishChanges = async () => {
  try {
    console.log('📤 Publicando cambios en HubSpot...');
    
    const url = `https://api.hubapi.com/cms/v3/hubdb/tables/${RESULTS_TABLE_ID}/draft/publish`;
    
    await axios.post(url, {}, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('✅ Cambios publicados');
    return true;
  } catch (error) {
    console.error('❌ Error publicando cambios:', error.response?.data || error.message);
    return false;
  }
};

