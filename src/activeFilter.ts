import { TokenData } from "./data-collector";

export interface ActiveTokens {
  activeBullish: TokenData[];
  activeBearish: TokenData[];
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

export function filterActiveTokens(
  bullishTokens: TokenData[], 
  bearishTokens: TokenData[]
): ActiveTokens {
  const result: ActiveTokens = {
    activeBullish: [],
    activeBearish: []
  };
  
  // Фильтруем бычьи токены
  for (const tokenData of bullishTokens) {
    const { indicators, price } = tokenData;
    const tf60 = indicators.tf60;
    const tf15 = indicators.tf15;
    
    if (tf60.ema100 === "N/A" || tf60.ema20 === "N/A" || tf60.vwap === "N/A") {
      continue;
    }
    
    const priceNum = parseNumber(price);
    const ema100_60 = parseNumber(tf60.ema100);
    const ema20_60 = parseNumber(tf60.ema20);
    const ema9_60 = parseNumber(tf60.ema9);
    const vwap_60 = parseNumber(tf60.vwap);
    const ema100_15 = parseNumber(tf15.ema100);
    
    // Условия для бычьего тренда
    const condition1 = priceNum > ema100_60 && priceNum > ema20_60;
    const condition2 = isBullishMACD(tf60.macdHistogram);
    const condition3 = tf60.trend === "up";
    const condition4 = priceNum > vwap_60;
    const condition5 = priceNum > ema100_15; // 15мин цена выше EMA100
    
    // Дополнительные (необязательные) условия
    const optional1 = priceNum > ema9_60; // цена выше EMA9
    const optional2 = ema20_60 > parseNumber(tf60.ema100); // EMA20 смотрит вверх
    const optional3 = ema9_60 > ema20_60; // EMA9 смотрит вверх
    
    if (condition1 && condition2 && condition3 && condition4 && condition5) {
      result.activeBullish.push(tokenData);
    }
  }
  
  // Фильтруем медвежьи токены
  for (const tokenData of bearishTokens) {
    const { indicators, price } = tokenData;
    const tf60 = indicators.tf60;
    const tf15 = indicators.tf15;
    
    if (tf60.ema100 === "N/A" || tf60.ema20 === "N/A" || tf60.vwap === "N/A") {
      continue;
    }
    
    const priceNum = parseNumber(price);
    const ema100_60 = parseNumber(tf60.ema100);
    const ema20_60 = parseNumber(tf60.ema20);
    const ema9_60 = parseNumber(tf60.ema9);
    const vwap_60 = parseNumber(tf60.vwap);
    const ema100_15 = parseNumber(tf15.ema100);
    
    // Условия для медвежьего тренда
    const condition1 = priceNum < ema100_60 && priceNum < ema20_60;
    const condition2 = isBearishMACD(tf60.macdHistogram);
    const condition3 = tf60.trend === "down";
    const condition4 = priceNum < vwap_60;
    const condition5 = priceNum < ema100_15; // 15мин цена ниже EMA100
    
    // Дополнительные (необязательные) условия
    const optional1 = priceNum < ema9_60; // цена ниже EMA9
    const optional2 = ema20_60 < parseNumber(tf60.ema100); // EMA20 смотрит вниз
    const optional3 = ema9_60 < ema20_60; // EMA9 смотрит вниз
    
    if (condition1 && condition2 && condition3 && condition4 && condition5) {
      result.activeBearish.push(tokenData);
    }
  }
  
  console.log(`🎯 Активные токены: Бычьих: ${result.activeBullish.length}, Медвежьих: ${result.activeBearish.length}`);
  
  return result;
}