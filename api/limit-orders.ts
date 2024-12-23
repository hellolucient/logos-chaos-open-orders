import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeOrders } from '../src/limitOrders/api';
import type { LimitOrder } from '../src/types/dca';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('Starting order analysis...');
    const orders: LimitOrder[] = await analyzeOrders();
    console.log('Analysis complete:', { orderCount: orders?.length });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300');
    
    return res.json({ orders });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 