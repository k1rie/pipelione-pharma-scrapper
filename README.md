# Backend

## Setup

```bash
npm install
```

Crear `.env`:
```env
OPENAI_API_KEY=tu_key
HUBSPOT_TOKEN=tu_token              # Token de HubSpot (usado para companies y deals)
HUBSPOT_PORTAL_ID=tu_portal_id
PORT=3000

# Límites de OpenAI (opcional - valores por defecto recomendados)
OPENAI_LIMIT_REQUESTS_PER_MINUTE=25    # Requests por minuto (rate limit)
OPENAI_LIMIT_REQUESTS_PER_DAY=500      # Requests por día
OPENAI_LIMIT_REQUESTS_PER_SESSION=100  # Requests por ejecución/sesión
OPENAI_LIMIT_COST_PER_DAY=10.0         # Costo máximo diario en USD

# Configuración de Deals en HubSpot (opcional)
HUBSPOT_PIPELINE_ID=811215668          # ID del pipeline de deals (default: 811215668)
HUBSPOT_DEAL_STAGE_ID=                 # ID del stage específico (opcional, usa primer stage si no se especifica)
```

## Ejecución

```bash
# Primera vez
npm run scrape

# Programar cada 3 meses
npm run scheduler

# Ejecutar ahora + programar
npm run scheduler:now
```

## Límites de OpenAI

El sistema incluye un sistema de límites automático para controlar el uso de OpenAI:

- **Requests por minuto**: Evita rate limits de la API (default: 25)
- **Requests por día**: Controla el uso diario (default: 500)
- **Requests por sesión**: Limita requests por ejecución (default: 100)
- **Costo diario**: Controla el gasto máximo diario en USD (default: $10)

Cuando se alcanza un límite, el sistema pausa automáticamente y muestra un mensaje de error.

### Ver estadísticas de uso

```bash
# Via API
curl http://localhost:3000/api/scraper/openai-usage

# O desde el código
import { getOpenAIUsageStats } from './services/openaiService.js';
const stats = getOpenAIUsageStats();
```

Los datos de uso se guardan en `backend/data/openai-usage.json` y se resetean automáticamente cada día.

## Servicio de Deals de HubSpot

El servicio `hubspotDealsService.js` permite crear deals en HubSpot a partir de posts de LinkedIn.

### Funciones disponibles:

- `getPipelinesAndStages()`: Obtiene todos los pipelines y stages disponibles
- `getValidStageId(pipelineId)`: Obtiene el primer stage válido de un pipeline
- `checkDuplicateDeal(postLink)`: Verifica si ya existe un deal con ese link
- `createDealForPost(postData, keyword)`: Crea un deal para un post de LinkedIn

### Ejemplo de uso:

```javascript
import { createDealForPost } from './services/hubspotDealsService.js';

const result = await createDealForPost({
  url: 'https://linkedin.com/posts/...',
  text: 'Contenido del post...',
  author: 'Nombre del Autor',
  profileUrl: 'https://linkedin.com/in/...',
  createdAt: new Date().toISOString()
}, 'keyword-usado');

if (result?.duplicate) {
  console.log('Deal duplicado, no se creó');
} else if (result) {
  console.log('Deal creado:', result.id);
}
```

## Docker

```bash
docker-compose up --build
```
# pipelione-pharma-scrapper
# pipelione-pharma-scrapper
# pipelione-pharma-scrapper
