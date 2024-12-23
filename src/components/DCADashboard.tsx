import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import type { ChartDataPoint, TokenSummary, Position, LimitOrder } from '../types/dca';
import { jupiterDCA } from '../api/jupiter';
import { LoadingSpinner } from './LoadingSpinner';
import { LimitOrderCard } from './LimitOrderCard';
import { Connection } from '@solana/web3.js';
import { formatOrderForUI } from '../limitOrders/api';
import { PublicKey } from '@solana/web3.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Chart configuration
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.8)'
      }
    },
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.8)'
      }
    }
  },
  plugins: {
    legend: {
      labels: {
        color: 'white',
        font: {
          size: 12
        }
      }
    }
  }
};

function PositionCard({ position, currentPrice }: { position: Position; currentPrice: number }) {
  return (
    <div className={`bg-[#2a2a2a] p-2 sm:p-4 rounded-lg border-l-4 ${
      position.type === 'BUY' ? 'border-green-500' : 'border-red-500'
    }`}>
      <div className="flex justify-between mb-2">
        <span className="text-sm sm:text-base">
          {position.type === 'BUY' ? '🟢 BUY' : '�� SELL'}
        </span>
        <span className="text-gray-500 text-xs sm:text-sm">
          {new Date(position.lastUpdate).toLocaleString()}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div>Total Amount: {Math.round(position.totalAmount).toLocaleString()} {position.inputToken}</div>
        <div>Split into: {position.totalCycles} orders ({Math.floor(position.totalCycles - position.completedCycles)} remaining)</div>
        <div>Order Size: ${Math.round(position.amountPerCycle)} per cycle (${Math.round(position.remainingInCycle)} remaining this cycle)</div>
        <div>Frequency: Every {position.cycleFrequency}s</div>
        
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div>Status: {position.isActive ? '🚥 Active' : '⚪️ Completed'}</div>
          {position.type === "BUY" && (
            <>
              <div>Remaining USDC: ~{Math.round((position.totalCycles - position.completedCycles) * position.amountPerCycle).toLocaleString()} USDC</div>
              <div>Max Price: {position.maxPrice === "No limit" ? "Infinity" : position.maxPrice?.toFixed(6)} USDC per {position.token}</div>
              <div>Est. {position.token} to receive: ~{Math.round(
                ((position.totalCycles - position.completedCycles) * position.amountPerCycle) * 
                (1 / currentPrice)
              ).toLocaleString()} {position.token}</div>
            </>
          )}
          {position.type === "SELL" && (
            <>
              <div>Remaining {position.token}: {((position.totalCycles - position.completedCycles) * position.amountPerCycle).toLocaleString()} {position.token}</div>
              <div>Min Price: {position.minPrice?.toFixed(6) || '-'} USDC per {position.token}</div>
              <div>Est. USDC to receive: ~{position.minPrice ? 
                (((position.totalCycles - position.completedCycles) * position.amountPerCycle) * position.minPrice).toLocaleString() 
                : '-'} USDC</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Add connection prop back
interface DCADashboardProps {
  connection: Connection;
}

export function DCADashboard({ connection }: DCADashboardProps) {
  const [chartData, setChartData] = useState<Record<string, ChartDataPoint[]>>({});
  const [summaryData, setSummaryData] = useState<Record<string, TokenSummary>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
  const [limitOrdersLoading, setLimitOrdersLoading] = useState(true);
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'dca' | 'limit'>('all');

  const fetchData = async () => {
    try {
      console.log('Starting data fetch...');
      setLoading(true);
      setError(null); // Clear any previous errors
      
      const data = await jupiterDCA.getDCAAccounts();
      
      if (!data.positions || !data.summary) {
        throw new Error('Invalid data received');
      }
      
      setPositions(data.positions);
      setSummaryData(data.summary);
      setChartData(data.chartData);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch DCA data:', err);
      setError('Failed to fetch data. Retrying...');
      // Try again after a delay
      setTimeout(fetchData, 2000);
    }
  };

  const fetchLimitOrders = async () => {
    try {
      setLimitOrdersLoading(true);
      const response = await fetch('/api/limit-orders');
      const { orders } = await response.json();
      
      const formattedOrders = orders.map((order: Omit<LimitOrder, 'maker'> & { maker: string }) => ({
        ...order,
        maker: new PublicKey(order.maker)
      }));
      
      setLimitOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching limit orders:', error);
    } finally {
      setLimitOrdersLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
    fetchLimitOrders();
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    let intervalId: number;

    if (autoRefresh && connection) {
      intervalId = window.setInterval(() => {
        fetchData();
        fetchLimitOrders();
      }, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, connection]);

  // Add debug logs
  useEffect(() => {
    console.log('Current state:', {
      positions,
      summaryData,
      chartData,
      loading,
      error
    });
  }, [positions, summaryData, chartData, loading, error]);

  // Add debug logs for LOGOS positions
  useEffect(() => {
    console.log('LOGOS positions:', positions.filter(p => p.token === 'LOGOS'));
  }, [positions]);

  const createChartData = (token: string) => {
    console.log(`Creating ${token} chart with:`, {
      hasData: !!chartData[token]?.length,
      points: chartData[token]
    });
    
    if (!chartData[token]?.length) {
      return {
        labels: [],
        datasets: []
      };
    }
    
    return {
      labels: chartData[token].map(point => {
        const date = new Date(point.timestamp);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      }),
      datasets: [
        {
          label: 'Buy Volume',
          data: chartData[token].map(point => point.buyVolume),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2
        },
        {
          label: 'Sell Volume',
          data: chartData[token].map(point => point.sellVolume),
          borderColor: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2
        }
      ]
    };
  };

  // Add a debug log before the loading check
  console.log('Pre-render state:', { loading, positions: positions.length });

  useEffect(() => {
    if (connection) {
      fetchLimitOrders();
    }
  }, [connection]);

  // Add a debug log for limit orders state changes
  useEffect(() => {
    console.log('Limit orders updated:', {
      count: limitOrders.length,
      orders: limitOrders.map(order => ({
        token: order.tokenType,
        type: order.orderType,
        pair: `${order.inputMint.symbol}/${order.outputMint.symbol}`
      }))
    });
  }, [limitOrders]);

  // Add connection logging effect
  useEffect(() => {
    console.log('Connection changed:', {
      exists: !!connection,
      endpoint: connection?.rpcEndpoint,
      commitment: connection?.commitment
    });
  }, [connection]);

  useEffect(() => {
    console.log('LOGOS Orders Debug:', {
      totalOrders: limitOrders.length,
      allOrders: limitOrders.map(o => ({
        id: o.id,
        token: o.tokenType,
        type: o.orderType,
        pair: `${o.inputMint.symbol} → ${o.outputMint.symbol}`
      })),
      logosOrders: limitOrders
        .filter(o => o.tokenType === 'LOGOS')
        .map(o => ({
          id: o.id,
          type: o.orderType,
          pair: `${o.inputMint.symbol} → ${o.outputMint.symbol}`
        }))
    });
  }, [limitOrders]);

  useEffect(() => {
    console.log('CHAOS Orders Debug:', {
      totalOrders: limitOrders.length,
      allOrders: limitOrders.map(o => ({
        id: o.id,
        token: o.tokenType,
        type: o.orderType,
        pair: `${o.inputMint.symbol} → ${o.outputMint.symbol}`
      })),
      chaosOrders: limitOrders
        .filter(o => o.tokenType === 'CHAOS')
        .map(o => ({
          id: o.id,
          type: o.orderType,
          pair: `${o.inputMint.symbol} → ${o.outputMint.symbol}`
        }))
    });
  }, [limitOrders]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  console.log('Rendering dashboard with:', {
    positionsCount: positions.length,
    logosPositions: positions.filter(p => p.token === 'LOGOS').length,
    chaosPositions: positions.filter(p => p.token === 'CHAOS').length,
    hasSummary: !!summaryData?.LOGOS && !!summaryData?.CHAOS,
    hasChartData: !!chartData?.LOGOS?.length && !!chartData?.CHAOS?.length
  });

  return (
    <div className="container mx-auto p-2 sm:p-5">
      {(loading || limitOrdersLoading) && <LoadingSpinner />}
      {/* Status Banner */}
      <div className="bg-[#1a1a1a] p-3 sm:p-4 mb-3 sm:mb-5 rounded-lg border-l-4 border-yellow-500 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="text-gray-300 text-sm sm:text-base">
          Data as of {lastUpdate.toLocaleString()}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
          <button 
            className="bg-[#3a3a3a] px-3 py-1 sm:px-4 sm:py-2 rounded hover:bg-[#4a4a4a] text-sm sm:text-base"
            onClick={fetchData}
          >
            Refresh Now
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="auto-refresh" className="text-sm sm:text-base">Auto-refresh</label>
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex gap-2 mb-3">
        <button 
          className={`px-3 py-1 rounded text-sm ${
            orderTypeFilter === 'all' 
              ? 'bg-blue-500 text-white' 
              : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a]'
          }`}
          onClick={() => setOrderTypeFilter('all')}
        >
          All Orders
        </button>
        <button 
          className={`px-3 py-1 rounded text-sm ${
            orderTypeFilter === 'dca' 
              ? 'bg-blue-500 text-white' 
              : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a]'
          }`}
          onClick={() => setOrderTypeFilter('dca')}
        >
          DCA Only
        </button>
        <button 
          className={`px-3 py-1 rounded text-sm ${
            orderTypeFilter === 'limit' 
              ? 'bg-blue-500 text-white' 
              : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a]'
          }`}
          onClick={() => setOrderTypeFilter('limit')}
        >
          Limit Orders
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
        {/* LOGOS Section */}
        <section className="bg-[#1a1a1a] rounded-lg p-3 sm:p-5 mb-5">
          {/* Token name with current price */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-bold">LOGOS</h2>
            <div className="text-gray-400">
              <span className="mr-2">Current Price:</span>
              <span className="text-white font-bold">${summaryData?.LOGOS?.price.toFixed(6)}</span>
            </div>
          </div>
          
          {/* Summary Stats Grid - now 2 cards instead of 4 */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Buy Orders & Volume */}
            <div className="bg-[#2a2a2a] p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-400">Buy Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.LOGOS?.buyOrders}</p>
              <div className="mt-2">
                <p className="text-sm text-gray-400">Buy Volume</p>
                <p className="text-lg font-bold">{summaryData?.LOGOS?.buyVolume.toLocaleString()} LOGOS</p>
                <p className="text-sm text-gray-500">${summaryData?.LOGOS?.buyVolumeUSDC.toLocaleString()}</p>
              </div>
            </div>

            {/* Sell Orders & Volume */}
            <div className="bg-[#2a2a2a] p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-gray-400">Sell Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.LOGOS?.sellOrders}</p>
              <div className="mt-2">
                <p className="text-sm text-gray-400">Sell Volume</p>
                <p className="text-lg font-bold">{summaryData?.LOGOS?.sellVolume.toLocaleString()} LOGOS</p>
                <p className="text-sm text-gray-500">${summaryData?.LOGOS?.sellVolumeUSDC.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-[#2a2a2a] p-3 rounded-lg h-[300px] mb-5">
            <Line data={createChartData('LOGOS')} options={chartOptions} />
          </div>

          {/* Orders Grid */}
          <div className="grid md:grid-cols-2 gap-3">
            {/* DCA Orders */}
            <div>
              <h3 className="text-md font-semibold mb-3">DCA Orders</h3>
              <div className="space-y-3">
                {positions
                  .filter(p => p.token === 'LOGOS')
                  .map(position => (
                    <PositionCard 
                      key={position.id} 
                      position={position} 
                      currentPrice={position.currentPrice}
                    />
                  ))}
              </div>
            </div>

            {/* Limit Orders */}
            <div>
              <h3 className="text-md font-semibold mb-3">Limit Orders</h3>
              <div className="space-y-3">
                {limitOrders
                  .filter(order => order.tokenType === 'LOGOS')
                  .map(order => (
                    <LimitOrderCard key={order.id} order={order} />
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* CHAOS Section */}
        <section className="bg-[#1a1a1a] rounded-lg p-3 sm:p-5">
          {/* Token name with current price */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-bold">CHAOS</h2>
            <div className="text-gray-400">
              <span className="mr-2">Current Price:</span>
              <span className="text-white font-bold">${summaryData?.CHAOS?.price.toFixed(6)}</span>
            </div>
          </div>
          
          {/* Summary Stats Grid - now 2 cards instead of 4 */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Buy Orders & Volume */}
            <div className="bg-[#2a2a2a] p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-400">Buy Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.CHAOS?.buyOrders}</p>
              <div className="mt-2">
                <p className="text-sm text-gray-400">Buy Volume</p>
                <p className="text-lg font-bold">{summaryData?.CHAOS?.buyVolume.toLocaleString()} CHAOS</p>
                <p className="text-sm text-gray-500">${summaryData?.CHAOS?.buyVolumeUSDC.toLocaleString()}</p>
              </div>
            </div>

            {/* Sell Orders & Volume */}
            <div className="bg-[#2a2a2a] p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-gray-400">Sell Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.CHAOS?.sellOrders}</p>
              <div className="mt-2">
                <p className="text-sm text-gray-400">Sell Volume</p>
                <p className="text-lg font-bold">{summaryData?.CHAOS?.sellVolume.toLocaleString()} CHAOS</p>
                <p className="text-sm text-gray-500">${summaryData?.CHAOS?.sellVolumeUSDC.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-[#2a2a2a] p-3 rounded-lg h-[300px] mb-5">
            <Line data={createChartData('CHAOS')} options={chartOptions} />
          </div>

          {/* Orders Grid */}
          <div className="grid md:grid-cols-2 gap-3">
            {/* DCA Orders */}
            <div>
              <h3 className="text-md font-semibold mb-3">DCA Orders</h3>
              <div className="space-y-3">
                {positions
                  .filter(p => p.token === 'CHAOS')
                  .map(position => (
                    <PositionCard 
                      key={position.id} 
                      position={position} 
                      currentPrice={position.currentPrice}
                    />
                  ))}
              </div>
            </div>

            {/* Limit Orders */}
            <div>
              <h3 className="text-md font-semibold mb-3">Limit Orders</h3>
              <div className="space-y-3">
                {limitOrders
                  .filter(order => {
                    const isRelevant = order.tokenType === 'CHAOS';
                    console.log('Filtering CHAOS order:', {
                      id: order.id,
                      type: order.orderType,
                      token: order.tokenType,
                      pair: `${order.inputMint.symbol} → ${order.outputMint.symbol}`,
                      passes: isRelevant
                    });
                    return isRelevant;
                  })
                  .map(order => (
                    <LimitOrderCard key={order.id} order={order} />
                  ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
} 