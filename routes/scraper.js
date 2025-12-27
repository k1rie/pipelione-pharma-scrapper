import express from 'express';
import { scrapePipelines } from '../controllers/scraperController.js';
import { getOpenAIUsageStats } from '../services/openaiService.js';

const router = express.Router();

router.post('/pipelines', scrapePipelines);

// Endpoint para ver estadísticas de uso de OpenAI
router.get('/openai-usage', (req, res) => {
  try {
    const stats = getOpenAIUsageStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

