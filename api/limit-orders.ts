import type { VercelApiHandler } from '@vercel/node';
import { runAnalyzer } from '../src/limitOrders/runAnalyzer.js';

const handler: VercelApiHandler = async (req, res) => {
  try {
    console.log('Starting limit orders API request...');
    console.log('Helius URL configured:', !!process.env.HELIUS_RPC_URL);
    
    // Instead of writing to file, just return the data directly
    const orders = await runAnalyzer();
    console.log(`Successfully processed ${orders.length} orders`);
    
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
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Send a more structured error response
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
};

export default handler; 