import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN;
const LIST_ID = '901707530437';

// Mapeo de opciones para custom fields
const AREA_OPTIONS = {
  'Cardiology': 'Cardiology',
  'Neumology': 'Neumology',
  'Oncologia': 'Oncologia',
  'Vacunas': 'Vacunas',
  'Inflamación e Inmunología': 'Inflamación e Inmunología',
  'Medicina interna': 'Medicina interna',
  'Inmunologia': 'Inmunologia',
  'Neurología': 'Neurología',
  'Enfermedades raras': 'Enfermedades raras',
  'Cáncer': 'Cáncer',
  'Salud cardiometabolica': 'Salud cardiometabolica',
  'Neurociencia': 'Neurociencia',
  'Otras especialidades': 'Otras especialidades',
  'Cuidado ocular': 'Cuidado ocular',
  'Respiratorio': 'Respiratorio',
  'Metabolico': 'Metabolico',
  'infectología': 'infectología',
  'oftalmología': 'oftalmología',
  'antiviral': 'antiviral',
  'Nefrología': 'Nefrología',
  'Hematología': 'Hematología',
  'Diabetes': 'Diabetes',
  'Salud ocular': 'Salud ocular',
  'Medicina genetica': 'Medicina genetica',
  'Salud femenina': 'Salud femenina',
  'Cuidados intensivos': 'Cuidados intensivos',
  'Hepatología': 'Hepatología',
  'Endocrinología': 'Endocrinología',
  'Varios': 'Varios',
  'Neuromuscular': 'Neuromuscular',
  'Gastrointestinal': 'Gastrointestinal',
  'Salud ósea': 'Salud ósea',
  'Dolor': 'Dolor',
  'Medicina reproductiva': 'Medicina reproductiva',
  'Urología': 'Urología',
  'Salud materna': 'Salud materna',
  'Gastroenterología': 'Gastroenterología',
  'Alergias': 'Alergias',
  'Autoinmune': 'Autoinmune',
  'Salud articular': 'Salud articular',
  'Animal': 'Animal',
  'Anticoagulante': 'Anticoagulante',
  'VIH': 'VIH',
  'Depresión': 'Depresión',
  'Hiperplasia': 'Hiperplasia',
  'Psiquiatría': 'Psiquiatría',
  'Dermatología': 'Dermatología'
};

const COMPANY_OPTIONS = {
  'Pfizer': 'Pfizer',
  'Sanofi': 'Sanofi',
  'Lilly': 'Lilly',
  'Abbvie': 'Abbvie',
  'MSD': 'MSD',
  'Roche': 'Roche',
  'roce': 'roce',
  'Otsuka': 'Otsuka',
  'JNJ': 'JNJ',
  'Merck & Co.': 'Merck & Co.',
  'Amgen': 'Amgen',
  'Insilico': 'Insilico',
  'Regeneron': 'Regeneron',
  'Novo Nordisk': 'Novo Nordisk',
  'Kura': 'Kura',
  'HerBaby': 'HerBaby',
  'Astellas Pharma': 'Astellas Pharma',
  'Juno Therapeutics': 'Juno Therapeutics',
  'Bristol Myers Squibb': 'Bristol Myers Squibb',
  'Daiichi Sankyo': 'Daiichi Sankyo',
  'AstraZeneca': 'AstraZeneca',
  'Bayer': 'Bayer',
  'Boehringer Ingelheim': 'Boehringer Ingelheim',
  'Grifols': 'Grifols',
  'Sandoz': 'Sandoz',
  'Takeda': 'Takeda',
  'grunenthal': 'grunenthal',
  'glenmark': 'glenmark',
  'Ferring': 'Ferring',
  "Dr.Reddy's Laboratories": "Dr.Reddy's Laboratories",
  'Hetero Drugs Limited': 'Hetero Drugs Limited',
  'Virbac': 'Virbac',
  'Aurobindo Pharma': 'Aurobindo Pharma',
  'Torrent pharmaceuticals': 'Torrent pharmaceuticals'
};

const PHASE_OPTIONS = {
  '1': '1',
  '2': '2',
  '3': '3',
  'Filed': 'Filed',
  'Approved': 'Approved',
  'Registration': 'Registration',
  'Ilegal': 'Ilegal',
  'Submission': 'Submission',
  'Comercializado': 'Comercializado',
  'Preclínica': 'Preclínica',
  'Fase I': '1',
  'Fase II': '2',
  'Fase III': '3',
  'Fase 1': '1',
  'Fase 2': '2',
  'Fase 3': '3'
};

let customFieldsCache = null;

/**
 * Obtiene los custom fields de la lista con sus opciones y UUIDs
 */
async function getCustomFields() {
  if (customFieldsCache) return customFieldsCache;
  
  try {
    const response = await axios.get(
      `https://api.clickup.com/api/v2/list/${LIST_ID}/field`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    customFieldsCache = {};
    
    response.data.fields.forEach(field => {
      customFieldsCache[field.name] = {
        id: field.id,
        type: field.type,
        options: {}
      };
      
      // Si es dropdown, mapear opciones a UUIDs
      if (field.type_config?.options) {
        field.type_config.options.forEach(option => {
          const optionName = option.name || option.label;
          customFieldsCache[field.name].options[optionName] = option.id || option.orderindex;
        });
      }
    });
    
    return customFieldsCache;
  } catch (error) {
    console.error('❌ Error obteniendo custom fields:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Encuentra el UUID de la opción más cercana en un dropdown
 */
function findOptionUuid(value, fieldOptions, fieldName = '') {
  if (!value || !fieldOptions) return null;
  
  const normalized = String(value).trim().toLowerCase();
  
  // Buscar coincidencia exacta
  for (const [optionName, uuid] of Object.entries(fieldOptions)) {
    if (optionName.toLowerCase() === normalized) {
      console.log(`  ✓ ${fieldName}: "${optionName}"`);
      return uuid;
    }
  }
  
  // Buscar coincidencia parcial
  for (const [optionName, uuid] of Object.entries(fieldOptions)) {
    if (normalized.includes(optionName.toLowerCase()) || 
        optionName.toLowerCase().includes(normalized)) {
      console.log(`  ✓ ${fieldName}: "${optionName}" (parcial)`);
      return uuid;
    }
  }
  
  console.log(`  ⚠️  ${fieldName}: "${value}" no encontrado`);
  return null;
}

/**
 * Busca una tarea existente por nombre en ClickUp
 */
async function findExistingTask(taskName) {
  try {
    const response = await axios.get(
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json'
        },
        params: {
          archived: false
        }
      }
    );
    
    const existing = response.data.tasks.find(task => 
      task.name.toLowerCase() === taskName.toLowerCase()
    );
    
    return existing || null;
  } catch (error) {
    console.error(`  ❌ Error buscando tarea:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Crea o actualiza una tarea en ClickUp
 */
export const createClickUpTask = async (medication) => {
  try {
    const taskName = medication.molecula;
    
    // Buscar si ya existe
    const existing = await findExistingTask(taskName);
    
    const customFields = await getCustomFields();
    
    if (existing) {
      // Actualizar solo la fase
      console.log(`  🔄 Actualizando fase en ClickUp: ${taskName}`);
      
      const faseField = customFields['Fase'];
      if (faseField) {
        const faseUuid = findOptionUuid(medication.fase_cofepris, faseField.options, 'Fase');
        
        if (faseUuid) {
          await axios.post(
            `https://api.clickup.com/api/v2/task/${existing.id}/field/${faseField.id}`,
            {
              value: faseUuid
            },
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log(`  ✅ Fase actualizada: ${existing.id}`);
        }
      }
      
      return true;
    }
    
    // Crear nueva tarea
    console.log(`  📝 Creando tarea en ClickUp: ${taskName}`);
    
    const taskData = {
      name: taskName,
      description: `Medicamento extraído automáticamente del pipeline de ${medication.empresa}`,
      custom_fields: []
    };
    
    // Agregar Área Terapéutica
    const areaField = customFields['Área Terapéutica'];
    if (areaField) {
      const areaUuid = findOptionUuid(medication.area_terapeutica, areaField.options, 'Área Terapéutica');
      if (areaUuid) {
        taskData.custom_fields.push({
          id: areaField.id,
          value: areaUuid
        });
      }
    }
    
    // Agregar Empresa
    const empresaField = customFields['empresa'];
    if (empresaField) {
      const empresaUuid = findOptionUuid(medication.empresa, empresaField.options, 'Empresa');
      if (empresaUuid) {
        taskData.custom_fields.push({
          id: empresaField.id,
          value: empresaUuid
        });
      }
    }
    
    // Agregar Fase
    const faseField = customFields['Fase'];
    if (faseField) {
      const faseUuid = findOptionUuid(medication.fase_cofepris, faseField.options, 'Fase');
      if (faseUuid) {
        taskData.custom_fields.push({
          id: faseField.id,
          value: faseUuid
        });
      }
    }
    
    const response = await axios.post(
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task`,
      taskData,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`  ✅ Tarea creada: ${response.data.id}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error en ClickUp:`, error.response?.data || error.message);
    return false;
  }
};

/**
 * Crea múltiples tareas en ClickUp
 */
export const createClickUpTasks = async (medications) => {
  console.log(`📋 Creando ${medications.length} tareas en ClickUp...`);
  
  let success = 0;
  let failed = 0;
  
  for (const med of medications) {
    const result = await createClickUpTask(med);
    if (result) {
      success++;
    } else {
      failed++;
    }
    
    // Delay para no saturar API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`✅ ClickUp: ${success} creadas, ❌ ${failed} fallidas`);
  
  return { success, failed };
};

