import type { VercelApiHandler } from '@vercel/node';
import { runAnalyzer } from '../src/limitOrders/runAnalyzer';

const handler: VercelApiHandler = async (req, res) => {
  try {
    // Instead of writing to file, just return the data directly
    const orders = await runAnalyzer();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300');
    
    // Return the same structure that was in the JSON file
    res.json({
      lastUpdate: new Date().toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        hour12: false
      }).replace(',', '') + ' +UTC',
      orders
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

export default handler; 