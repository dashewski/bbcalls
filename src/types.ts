interface TimeframeIndicators {
  timeframe: number;
  ema9: string;
  ema20: string;
  ema100: string;
  vwap: string;
  macdHistogram: string;
  supertrend: string; // value.toFixed(6)
  trend?: "up" | "down"; // из supertrend можно вытащить
}

interface TokenData {
  token: string;
  price: string;
  indicators: {
    tf3: TimeframeIndicators;
    tf15: TimeframeIndicators;
    tf60: TimeframeIndicators;
    tf240: TimeframeIndicators;
  };
}

// В findTrade.ts
interface TradeSignal {
  token: string;
  direction: "LONG" | "SHORT";
  timeframe: 3 | 15; // на каком ТФ сигнал
  signalType: "ENTRY" | "EXIT";
  price: string;
  strength: "STRONG" | "REGULAR";
  timestamp: Date;
}