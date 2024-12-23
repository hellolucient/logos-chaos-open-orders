import { DCADashboard } from './components/DCADashboard';
import { Connection } from '@solana/web3.js';

function App() {
  // Use the same Helius RPC endpoint that works for DCA orders
  const connection = new Connection(
    import.meta.env.VITE_HELIUS_RPC_URL,
    'confirmed'
  );

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <DCADashboard connection={connection} />
    </div>
  );
}

export default App;
