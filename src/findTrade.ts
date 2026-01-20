import { TokenData } from './data-collector';
import { ActiveTokens } from './activeFilter';

export interface TradeSignal {
  token: string;
  direction: "LONG" | "SHORT";
  timeframe: 3 | 15;
  price: string;
  strength: "STRONG" | "REGULAR";
  timestamp: Date;
}

function parseNumber(value: string): number {
  return parseFloat(value) || 0;
}

function isBullishMACD(macdHistogram: string): boolean {
  if (macdHistogram === "N/A") return false;
  const hist = parseNumber(macdHistogram);
  return hist > -0.000005;
}

function isBearishMACD(macdHistogram: string): boolean {
  if (macdHistogram === "N/A") return false;
  const hist = parseNumber(macdHistogram);
  return hist < 0.000005;
}

function checkEMACrossover(ema9: string, ema20: string, direction: "BULLISH" | "BEARISH"): boolean {
  const ema9Num = parseNumber(ema9);
  const ema20Num = parseNumber(ema20);
  
  if (ema9Num === 0 || ema20Num === 0) return false;
  
  const diffPercent = Math.abs(ema9Num - ema20Num) / ema20Num * 100;
  
  if (direction === "BULLISH") {
    // EMA9 почти пробивает EMA20 вверх
    return ema9Num > ema20Num && diffPercent < 0.05;
  } else {
    // EMA9 почти пробивает EMA20 вниз
    return ema9Num < ema20Num && diffPercent < 0.05;
  }
}

export function findTrades(activeTokens: ActiveTokens): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const timestamp = new Date();
  
  // Проверяем бычьи токены для лонга
  for (const tokenData of activeTokens.activeBullish) {
    const { token, price, indicators } = tokenData;
    
    // Проверяем 15-минутный ТФ
    const tf15 = indicators.tf15;
    const priceNum = parseNumber(price);
    const ema100_15 = parseNumber(tf15.ema100);
    
    if (priceNum > ema100_15 && isBullishMACD(tf15.macdHistogram)) {
      // Проверяем пересечение EMA на 15м
      if (checkEMACrossover(tf15.ema9, tf15.ema20, "BULLISH")) {
        signals.push({
          token,
          direction: "LONG",
          timeframe: 15,
          price,
          strength: "STRONG",
          timestamp
        });
      }
    }
    
    // Проверяем 3-минутный ТФ
    const tf3 = indicators.tf3;
    const ema100_3 = parseNumber(tf3.ema100);
    
    if (priceNum > ema100_3 && isBullishMACD(tf3.macdHistogram)) {
      // Проверяем пересечение EMA на 3м
      if (checkEMACrossover(tf3.ema9, tf3.ema20, "BULLISH")) {
        signals.push({
          token,
          direction: "LONG",
          timeframe: 3,
          price,
          strength: "REGULAR", // 3м сигналы обычно слабее
          timestamp
        });
      }
    }
  }
  
  // Проверяем медвежьи токены для шорта
  for (const tokenData of activeTokens.activeBearish) {
    const { token, price, indicators } = tokenData;
    
    // Проверяем 15-минутный ТФ
    const tf15 = indicators.tf15;
    const priceNum = parseNumber(price);
    const ema100_15 = parseNumber(tf15.ema100);
    
    if (priceNum < ema100_15 && isBearishMACD(tf15.macdHistogram)) {
      // Проверяем пересечение EMA на 15м
      if (checkEMACrossover(tf15.ema9, tf15.ema20, "BEARISH")) {
        signals.push({
          token,
          direction: "SHORT",
          timeframe: 15,
          price,
          strength: "STRONG",
          timestamp
        });
      }
    }
    
    // Проверяем 3-минутный ТФ
    const tf3 = indicators.tf3;
    const ema100_3 = parseNumber(tf3.ema100);
    
    if (priceNum < ema100_3 && isBearishMACD(tf3.macdHistogram)) {
      // Проверяем пересечение EMA на 3м
      if (checkEMACrossover(tf3.ema9, tf3.ema20, "BEARISH")) {
        signals.push({
          token,
          direction: "SHORT",
          timeframe: 3,
          price,
          strength: "REGULAR",
          timestamp
        });
      }
    }
  }
  
  return signals;
}

//console log
export function printTradeSignals(signals: TradeSignal[]): void {
  if (signals.length === 0) {
    console.log("📭 Торговых сигналов не найдено");
    return;
  }
  
  console.log("\n🎯 НАЙДЕНЫ ТОРГОВЫЕ СИГНАЛЫ:");
  console.log("=".repeat(50));
  
  for (const signal of signals) {
    const emoji = signal.direction === "LONG" ? "📈" : "📉";
    const directionText = signal.direction === "LONG" ? "ЛОНГ" : "ШОРТ";
    const strengthEmoji = signal.strength === "STRONG" ? "🔥" : "⚡";
    const priceFormatted = parseFloat(signal.price).toFixed(4);
    
    console.log(
      `${emoji} ${strengthEmoji} ${signal.token}: Сделка в ${directionText} ${signal.timeframe}м | ` +
      `Цена: $${priceFormatted} | ` +
      `Время: ${signal.timestamp.toLocaleTimeString()}`
    );
  }
  
  console.log("=".repeat(50));
}