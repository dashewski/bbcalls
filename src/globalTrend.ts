import { TokenData } from "./data-collector";

export interface GlobalTrendResult {
  bullishTokens: TokenData[];
  bearishTokens: TokenData[];
  neutralTokens: TokenData[];
}

function parseNumber(value: string): number {
  return parseFloat(value) || 0;
}

function isBullishMACD(macdHistogram: string): boolean {
  if (macdHistogram === "N/A") return false;
  const hist = parseNumber(macdHistogram);
  return hist > -0.000005; // "почти зеленый"
}

function isBearishMACD(macdHistogram: string): boolean {
  if (macdHistogram === "N/A") return false;
  const hist = parseNumber(macdHistogram);
  return hist < 0.000005; // "почти красный"
}

export function analyzeGlobalTrend(tokensData: TokenData[]): GlobalTrendResult {
  const result: GlobalTrendResult = {
    bullishTokens: [],
    bearishTokens: [],
    neutralTokens: []
  };

  for (const tokenData of tokensData) {
    const { indicators, price } = tokenData;
    const tf60 = indicators.tf60;
    const tf240 = indicators.tf240;
    
    if (tf60.ema100 === "N/A" || tf240.ema100 === "N/A") {
      result.neutralTokens.push(tokenData);
      continue;
    }
    
    const priceNum = parseNumber(price);
    const ema100_60 = parseNumber(tf60.ema100);
    const ema20_60 = parseNumber(tf60.ema20);
    const supertrend_60 = parseNumber(tf60.supertrend);
    
    const ema100_240 = parseNumber(tf240.ema100);
    const ema20_240 = parseNumber(tf240.ema20);
    const supertrend_240 = parseNumber(tf240.supertrend);
    
    // Проверяем бычий тренд на 60м и 240м
    const isBullish60 = (
      priceNum > ema100_60 &&
      priceNum > ema20_60 &&
      priceNum > supertrend_60 &&
      tf60.trend === "up"
    );
    
    const isBullish240 = (
      priceNum > ema100_240 &&
      priceNum > ema20_240 &&
      priceNum > supertrend_240 &&
      tf240.trend === "up"
    );
    
    // Проверяем медвежий тренд на 60м и 240м
    const isBearish60 = (
      priceNum < ema100_60 &&
      priceNum < ema20_60 &&
      priceNum < supertrend_60 &&
      tf60.trend === "down"
    );
    
    const isBearish240 = (
      priceNum < ema100_240 &&
      priceNum < ema20_240 &&
      priceNum < supertrend_240 &&
      tf240.trend === "down"
    );
    
    // Определяем тренд
    if ((isBullish60 && isBullish240) || (isBullish60 && !isBearish240)) {
      result.bullishTokens.push(tokenData);
    } else if ((isBearish60 && isBearish240) || (isBearish60 && !isBullish240)) {
      result.bearishTokens.push(tokenData);
    } else {
      result.neutralTokens.push(tokenData);
    }
  }
  
  console.log(`📊 Глобальный тренд: Бычьих: ${result.bullishTokens.length}, Медвежьих: ${result.bearishTokens.length}, Нейтральных: ${result.neutralTokens.length}`);
  
  return result;
}