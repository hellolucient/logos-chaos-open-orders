import type { IncomingMessage, ServerResponse } from 'http';
import { analyzeOrders } from '../src/limitOrders/api';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const orders = await analyzeOrders();
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.end(JSON.stringify({ orders }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Failed to fetch orders' }));
  }
} 