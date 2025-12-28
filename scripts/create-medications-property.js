import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde el directorio backend
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HUBSPOT_KEY = process.env.HUBSPOT_TOKEN || process.env.HUBSPOT_KEY;

if (!HUBSPOT_KEY) {
  console.error('❌ Error: No se encontró HUBSPOT_TOKEN o HUBSPOT_KEY en el archivo .env');
  console.log('💡 Asegúrate de que el archivo backend/.env contiene una de estas variables');
  process.exit(1);
}

/**
 * Crea la propiedad medications_found_last_scrape en HubSpot
 */
async function createMedicationsProperty() {
  try {
    console.log('🚀 Creando propiedad medications_found_last_scrape en HubSpot...\n');
    
    // Verificar si ya existe
    try {
      const checkResponse = await axios.get(
        'https://api.hubapi.com/crm/v3/properties/companies/medications_found_last_scrape',
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      console.log('✅ La propiedad ya existe!');
      console.log('📋 Detalles:', {
        name: checkResponse.data.name,
        label: checkResponse.data.label,
        type: checkResponse.data.type,
        fieldType: checkResponse.data.fieldType
      });
      
      return true;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
      // Si es 404, la propiedad no existe, continuar con la creación
      console.log('ℹ️  La propiedad no existe, creándola...\n');
    }
    
    // Crear la propiedad
    const response = await axios.post(
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
    
    console.log('✅ Propiedad creada exitosamente!');
    console.log('📋 Detalles:', {
      name: response.data.name,
      label: response.data.label,
      type: response.data.type,
      fieldType: response.data.fieldType
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Elimina este script después de ejecutarse
 */
function deleteSelf() {
  try {
    console.log('\n🗑️  Eliminando script...');
    fs.unlinkSync(__filename);
    console.log('✅ Script eliminado exitosamente');
  } catch (error) {
    console.error('⚠️  No se pudo eliminar el script:', error.message);
    console.log('💡 Puedes eliminarlo manualmente: backend/scripts/create-medications-property.js');
  }
}

// Ejecutar
async function main() {
  const success = await createMedicationsProperty();
  
  if (success) {
    console.log('\n✨ Proceso completado!');
    console.log('💡 Ahora puedes ejecutar el scraping normalmente\n');
    
    // Auto-eliminar el script
    deleteSelf();
  } else {
    console.log('\n❌ El proceso falló. El script NO se eliminará para que puedas intentar de nuevo.');
    process.exit(1);
  }
}

main();

