import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const HUBSPOT_PIPELINE_ID = process.env.HUBSPOT_PIPELINE_ID || '811215668';
const HUBSPOT_DEAL_STAGE_ID = process.env.HUBSPOT_DEAL_STAGE_ID || null;

const BASE_URL = 'https://api.hubapi.com';

/**
 * Obtiene todos los pipelines y stages disponibles de HubSpot
 * @returns {Promise<Array>} Array de pipelines con sus stages
 */
export const getPipelinesAndStages = async () => {
  try {
    const response = await axios.get(
      `${BASE_URL}/crm/v3/pipelines/deals`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Error obteniendo pipelines y stages:', error.response?.data || error.message);
    return [];
  }
};

/**
 * Obtiene el primer stage válido de un pipeline específico
 * @param {string} pipelineId - ID del pipeline (opcional, si no se especifica usa el primero disponible)
 * @returns {Promise<string|null>} ID del primer stage o null si hay error
 */
export const getValidStageId = async (pipelineId = null) => {
  try {
    const pipelines = await getPipelinesAndStages();
    
    if (pipelines.length === 0) {
      console.error('❌ No se encontraron pipelines en HubSpot');
      return null;
    }

    let targetPipeline = null;

    if (pipelineId) {
      // Validar que pipelineId sea numérico
      if (!/^\d+$/.test(pipelineId)) {
        console.error(`❌ Pipeline ID inválido: ${pipelineId}. Debe ser numérico.`);
        return null;
      }

      targetPipeline = pipelines.find(p => p.id === pipelineId);
      if (!targetPipeline) {
        console.error(`❌ Pipeline con ID ${pipelineId} no encontrado`);
        return null;
      }
    } else {
      // Usar el primer pipeline disponible
      targetPipeline = pipelines[0];
    }

    // Obtener el primer stage del pipeline
    if (!targetPipeline.stages || targetPipeline.stages.length === 0) {
      console.error(`❌ Pipeline ${targetPipeline.id} no tiene stages`);
      return null;
    }

    const firstStage = targetPipeline.stages[0];
    return firstStage.id;
  } catch (error) {
    console.error('❌ Error obteniendo stage válido:', error.response?.data || error.message);
    return null;
  }
};

/**
 * Verifica si ya existe un deal con ese link del post
 * @param {string} postLink - URL del post de LinkedIn
 * @returns {Promise<boolean>} true si existe duplicado, false si no
 */
export const checkDuplicateDeal = async (postLink) => {
  try {
    if (!postLink) {
      return false;
    }

    const response = await axios.post(
      `${BASE_URL}/crm/v3/objects/deals/search`,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'description',
                operator: 'CONTAINS_TOKEN',
                value: postLink
              }
            ]
          }
        ],
        limit: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );

    return (response.data.results && response.data.results.length > 0);
  } catch (error) {
    // Si el error es 404 o no hay resultados, no es duplicado
    if (error.response?.status === 404 || error.response?.status === 400) {
      return false;
    }
    console.error('❌ Error verificando duplicados:', error.response?.data || error.message);
    return false;
  }
};

/**
 * Crea un deal en HubSpot para un post de LinkedIn
 * @param {Object} postData - Datos del post {url, text, author, profileUrl, createdAt}
 * @param {string} keyword - Keyword usado para encontrar el post
 * @returns {Promise<Object|null>} Deal creado o {duplicate: true} si es duplicado, null si hay error
 */
export const createDealForPost = async (postData, keyword) => {
  try {
    const { url, text, author, profileUrl, createdAt } = postData;

    // Validar datos requeridos
    if (!url || !author || !keyword) {
      console.error('❌ Faltan datos requeridos: url, author o keyword');
      return null;
    }

    // Verificar duplicados primero
    const isDuplicate = await checkDuplicateDeal(url);
    if (isDuplicate) {
      console.log(`⚠️  Deal duplicado encontrado para: ${url}`);
      return { duplicate: true };
    }

    // Construir descripción
    const textTruncated = text ? text.substring(0, 1000) : '';
    const description = `Post de LinkedIn encontrado por keyword: ${keyword}\n\n` +
      `Autor/Perfil: ${author}\n` +
      `URL del perfil: ${profileUrl || 'N/A'}\n` +
      `URL del post: ${url}\n\n` +
      `Contenido:\n${textTruncated}\n\n` +
      `Fecha del post: ${createdAt || new Date().toISOString()}\n`;

    // Obtener stage ID
    let dealStageId = null;

    if (HUBSPOT_DEAL_STAGE_ID) {
      // Validar que sea numérico
      if (!/^\d+$/.test(HUBSPOT_DEAL_STAGE_ID)) {
        console.error(`❌ HUBSPOT_DEAL_STAGE_ID inválido: ${HUBSPOT_DEAL_STAGE_ID}. Debe ser numérico.`);
        return null;
      }
      dealStageId = HUBSPOT_DEAL_STAGE_ID;
    } else {
      // Obtener primer stage del pipeline
      // Validar pipeline ID
      if (!/^\d+$/.test(HUBSPOT_PIPELINE_ID)) {
        console.error(`❌ HUBSPOT_PIPELINE_ID inválido: ${HUBSPOT_PIPELINE_ID}. Debe ser numérico.`);
        return null;
      }

      dealStageId = await getValidStageId(HUBSPOT_PIPELINE_ID);
      if (!dealStageId) {
        console.error('❌ No se pudo obtener un stage válido');
        return null;
      }
    }

    // Validar pipeline ID
    if (!/^\d+$/.test(HUBSPOT_PIPELINE_ID)) {
      console.error(`❌ HUBSPOT_PIPELINE_ID inválido: ${HUBSPOT_PIPELINE_ID}. Debe ser numérico.`);
      return null;
    }

    // Crear deal
    const dealName = `${author} - Post LinkedIn (${keyword})`;
    
    const dealData = {
      properties: {
        dealname: dealName,
        description: description,
        amount: '0',
        deal_currency_code: 'MXN',
        pipeline: HUBSPOT_PIPELINE_ID,
        dealstage: dealStageId
      }
    };

    const response = await axios.post(
      `${BASE_URL}/crm/v3/objects/deals`,
      dealData,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log(`✅ Deal creado exitosamente: ${dealName} (ID: ${response.data.id})`);
    return response.data;

  } catch (error) {
    console.error('❌ Error creando deal:', error.response?.data || error.message);
    return null;
  }
};

