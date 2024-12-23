import { LimitOrder } from '../types/dca';

interface LimitOrderCardProps {
  order: LimitOrder;
}

export function LimitOrderCard({ order }: LimitOrderCardProps) {
  const getBorderColor = (orderType: 'BUY' | 'SELL') => {
    return orderType === 'BUY' ? 'border-green-500' : 'border-red-500';
  };

  const formatDate = (date: string | Date | undefined): string => {
    if (!date) return 'Never';
    if (date === 'None') return 'Never';
    if (typeof date === 'string') return date;
    return date.toLocaleString();
  };

  const calculatePrice = (order: LimitOrder) => {
    console.log('Price calculation:', {
      making: order.makingAmount,
      taking: order.takingAmount,
      inputDecimals: order.inputMint.decimals,
      outputDecimals: order.outputMint.decimals
    });

    if (order.makingAmount === 0) return '0';

    // Simple division - amounts are already in correct decimals
    const price = order.takingAmount / order.makingAmount;
    
    // Format to reasonable number of decimal places
    return price.toFixed(6);
  };

  return (
    <div className={`bg-[#2a2a2a] p-4 rounded-lg border-l-4 ${getBorderColor(order.orderType)}`}>
      <div className="flex justify-between mb-2">
        <span className={`text-sm ${order.orderType === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
          {order.orderType === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
        </span>
        <span className="text-gray-500 text-xs">
          {formatDate(order.createdAt)}
        </span>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Amount:</span>
          <span className="text-white">
            {order.makingAmount.toLocaleString()} {order.inputMint.symbol}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Limit Price:</span>
          <span className="text-white flex items-center">
            {order.inputMint.isDecimalKnown && order.outputMint.isDecimalKnown ? (
              `${calculatePrice(order)} ${order.outputMint.symbol}`
            ) : (
              <>
                <span className="text-yellow-500 mr-1">⚠️</span>
                <span title="Token decimals unknown">Price unknown</span>
              </>
            )}
          </span>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Status:</span>
            <span className="text-yellow-500">⏳ {order.status.toUpperCase()}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Expires:</span>
            <span className="text-gray-300">
              {formatDate(order.expiredAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 