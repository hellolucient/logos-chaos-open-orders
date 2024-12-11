import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import type { ChartDataPoint, TokenSummary, Position } from '../types/dca';
import { jupiterDCA } from '../api/jupiter';
import { LoadingSpinner } from './LoadingSpinner';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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

export const DCADashboard: React.FC = () => {
  const [chartData, setChartData] = useState<Record<string, ChartDataPoint[]>>({});
  const [summaryData, setSummaryData] = useState<Record<string, TokenSummary>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      console.log('Starting data fetch...');
      setLoading(true);
      
      const data = await jupiterDCA.getDCAAccounts();
      console.log('Received data:', {
        positions: data.positions.length,
        summary: Object.keys(data.summary),
        chartData: Object.keys(data.chartData)
      });
      
      setPositions(data.positions);
      setSummaryData(data.summary);
      setChartData(data.chartData);
      setLastUpdate(new Date());
      
      console.log('States updated, setting loading to false');
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch DCA data:', err);
      setError('Failed to fetch DCA data');
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    let intervalId: number;

    if (autoRefresh) {
      intervalId = window.setInterval(() => {
        fetchData();
      }, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh]);

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
    <div className="container mx-auto p-5">
      {loading && <LoadingSpinner />}
      
      {/* Status Banner */}
      <div className="bg-[#1a1a1a] p-4 mb-5 rounded-lg border-l-4 border-yellow-500 flex justify-between items-center">
        <div className="text-gray-300">
          Data as of {lastUpdate.toLocaleString()}
        </div>
        <div className="flex gap-4 items-center">
          <button 
            className="bg-[#3a3a3a] px-4 py-2 rounded hover:bg-[#4a4a4a]"
            onClick={fetchData}
          >
            Refresh Now
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="auto-refresh">Auto-refresh</label>
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

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-5">
        {/* LOGOS Section */}
        <section className="bg-[#1a1a1a] rounded-lg p-5">
          <h2 className="text-xl font-bold mb-4">LOGOS DCA</h2>
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Buy Stats */}
            <div className="bg-[#2a2a2a] p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-400">Buy Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.LOGOS?.buyOrders}</p>
              <div className="mt-4">
                <span className="text-gray-400">Buy Volume</span>
                <p className="text-xl font-bold">{summaryData?.LOGOS?.buyVolume.toLocaleString()}</p>
                <p className="text-sm text-gray-500">${summaryData?.LOGOS?.buyVolumeUSDC.toLocaleString()} USDC</p>
              </div>
            </div>

            {/* Sell Stats */}
            <div className="bg-[#2a2a2a] p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-gray-400">Sell Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.LOGOS?.sellOrders}</p>
              <div className="mt-4">
                <span className="text-gray-400">Sell Volume</span>
                <p className="text-xl font-bold">{summaryData?.LOGOS?.sellVolume.toLocaleString()}</p>
                <p className="text-sm text-gray-500">${summaryData?.LOGOS?.sellVolumeUSDC.toLocaleString()} USDC</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-[#2a2a2a] p-4 rounded-lg h-[300px] mb-5">
            <Line data={createChartData('LOGOS')} options={chartOptions} />
          </div>

          {/* Positions */}
          <div className="space-y-4">
            {positions
              .filter(position => position.token === 'LOGOS')
              .map((position) => (
                <div 
                  key={position.id} 
                  className={`bg-[#2a2a2a] p-4 rounded-lg border-l-4 ${
                    position.type === 'BUY' ? 'border-green-500' : 'border-red-500'
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <span>{position.type === 'BUY' ? '🟢 BUY' : '🔴 SELL'}</span>
                    <span className="text-gray-500">
                      {new Date(position.lastUpdate).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Input: {position.inputToken} ({position.inputAmount})</div>
                    <div>Output: {position.outputToken}</div>
                    <div>Remaining: {position.remainingCycles}/{position.totalAmount}</div>
                    <div>Frequency: {position.cycleFrequency}s</div>
                    
                    {position.targetPrice && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <div>Target Price: {position.targetPrice.toFixed(4)} {position.priceToken}</div>
                        {position.currentPrice && (
                          <div>Current Price: {position.currentPrice.toFixed(4)} {position.priceToken}</div>
                        )}
                        {position.estimatedOutput && (
                          <div>Est. Output: ~{position.estimatedOutput.toFixed(2)} {position.outputToken}</div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-2">
                      <a 
                        href={`https://solscan.io/account/${position.publicKey}/dca?cluster=mainnet-beta`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View on Solscan ↗
                      </a>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </section>

        {/* CHAOS Section */}
        <section className="bg-[#1a1a1a] rounded-lg p-5">
          <h2 className="text-xl font-bold mb-4">CHAOS DCA</h2>
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Buy Stats */}
            <div className="bg-[#2a2a2a] p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-400">Buy Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.CHAOS?.buyOrders}</p>
              <div className="mt-4">
                <span className="text-gray-400">Buy Volume</span>
                <p className="text-xl font-bold">{summaryData?.CHAOS?.buyVolume.toLocaleString()}</p>
                <p className="text-sm text-gray-500">${summaryData?.CHAOS?.buyVolumeUSDC.toLocaleString()} USDC</p>
              </div>
            </div>

            {/* Sell Stats */}
            <div className="bg-[#2a2a2a] p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-gray-400">Sell Orders</span>
              </div>
              <p className="text-xl font-bold">{summaryData?.CHAOS?.sellOrders}</p>
              <div className="mt-4">
                <span className="text-gray-400">Sell Volume</span>
                <p className="text-xl font-bold">{summaryData?.CHAOS?.sellVolume.toLocaleString()}</p>
                <p className="text-sm text-gray-500">${summaryData?.CHAOS?.sellVolumeUSDC.toLocaleString()} USDC</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-[#2a2a2a] p-4 rounded-lg h-[300px] mb-5">
            <Line data={createChartData('CHAOS')} options={chartOptions} />
          </div>

          {/* Positions */}
          <div className="space-y-4">
            {positions
              .filter(position => position.token === 'CHAOS')
              .map((position) => (
                <div 
                  key={position.id} 
                  className={`bg-[#2a2a2a] p-4 rounded-lg border-l-4 ${
                    position.type === 'BUY' ? 'border-green-500' : 'border-red-500'
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <span>{position.type === 'BUY' ? '🟢 BUY' : '🔴 SELL'}</span>
                    <span className="text-gray-500">
                      {new Date(position.lastUpdate).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Input: {position.inputToken} ({position.inputAmount})</div>
                    <div>Output: {position.outputToken}</div>
                    <div>Remaining: {position.remainingCycles}/{position.totalAmount}</div>
                    <div>Frequency: {position.cycleFrequency}s</div>
                    
                    {position.targetPrice && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <div>Target Price: {position.targetPrice.toFixed(4)} {position.priceToken}</div>
                        {position.currentPrice && (
                          <div>Current Price: {position.currentPrice.toFixed(4)} {position.priceToken}</div>
                        )}
                        {position.estimatedOutput && (
                          <div>Est. Output: ~{position.estimatedOutput.toFixed(2)} {position.outputToken}</div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-2">
                      <a 
                        href={`https://solscan.io/account/${position.publicKey}/dca?cluster=mainnet-beta`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View on Solscan ↗
                      </a>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}; 