import type { VercelApiHandler } from '@vercel/node';
import { analyzeOrders } from '../src/limitOrders/api';

const handler: VercelApiHandler = async (req, res) => {
  try {
    console.log('Starting order analysis...');
    const orders = await analyzeOrders();
    console.log('Analysis complete:', { orderCount: orders?.length });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300');
    
    res.json({ orders });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

export default handler; 