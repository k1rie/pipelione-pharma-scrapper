import dotenv from 'dotenv';
dotenv.config();

import { 
  getPipelinesAndStages, 
  getValidStageId, 
  checkDuplicateDeal, 
  createDealForPost 
} from '../services/hubspotDealsService.js';

/**
 * Script de prueba para el servicio de deals de HubSpot
 */
async function testHubSpotDeals() {
  console.log('🧪 Probando servicio de deals de HubSpot...\n');

  try {
    // 1. Probar obtener pipelines y stages
    console.log('1️⃣ Obteniendo pipelines y stages...');
    const pipelines = await getPipelinesAndStages();
    console.log(`   ✅ Encontrados ${pipelines.length} pipeline(s)`);
    
    if (pipelines.length > 0) {
      console.log(`   📋 Primer pipeline: ${pipelines[0].label} (ID: ${pipelines[0].id})`);
      if (pipelines[0].stages && pipelines[0].stages.length > 0) {
        console.log(`   📋 Primer stage: ${pipelines[0].stages[0].label} (ID: ${pipelines[0].stages[0].id})`);
      }
    }

    // 2. Probar obtener stage válido
    console.log('\n2️⃣ Obteniendo stage válido del pipeline default...');
    const stageId = await getValidStageId();
    if (stageId) {
      console.log(`   ✅ Stage ID obtenido: ${stageId}`);
    } else {
      console.log('   ❌ No se pudo obtener stage ID');
    }

    // 3. Probar verificación de duplicados (con URL de prueba)
    console.log('\n3️⃣ Probando verificación de duplicados...');
    const testUrl = 'https://linkedin.com/posts/test-123';
    const isDuplicate = await checkDuplicateDeal(testUrl);
    console.log(`   ${isDuplicate ? '⚠️  Duplicado encontrado' : '✅ No es duplicado'}`);

    // 4. Probar creación de deal (comentado para no crear deals de prueba)
    console.log('\n4️⃣ Prueba de creación de deal (comentada para evitar crear deals de prueba)');
    console.log('   💡 Descomenta el código siguiente para probar la creación:');
    console.log(`
    const testPost = {
      url: 'https://linkedin.com/posts/test-${Date.now()}',
      text: 'Este es un post de prueba para verificar el servicio de deals',
      author: 'Test User',
      profileUrl: 'https://linkedin.com/in/test-user',
      createdAt: new Date().toISOString()
    };
    
    const result = await createDealForPost(testPost, 'test-keyword');
    console.log('Resultado:', result);
    `);

    console.log('\n✅ Pruebas completadas!');
    console.log('\n📝 Nota: Para probar la creación de deals, descomenta el código en el script');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    if (error.response) {
      console.error('   Detalles:', error.response.data);
    }
    process.exit(1);
  }
}

testHubSpotDeals();

