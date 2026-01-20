import { EMA, MACD } from "technicalindicators";
import axios, { AxiosError } from "axios";

const TIMEFRAMES = [3, 15, 60, 240] as const;
const BYBIT_BASE_URL = "https://api.bybit.com";

const REQUEST_DELAY = 500; // 500ms между запросами
const MAX_RETRIES = 3; // Максимум 3 попытки
const TIMEOUT = 10000; // 10 секунд таймаут

// Создаем axios instance с настройками
const axiosInstance = axios.create({
  timeout: TIMEOUT,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// Функция для ретраев с задержкой
async function retryRequest<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = REQUEST_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && (axios.isAxiosError(error) || error instanceof Error)) {
      const isConnectionError = 
        (error as AxiosError).code === 'ECONNRESET' ||
        (error as AxiosError).code === 'ETIMEDOUT' ||
        (error as AxiosError).code === 'ECONNABORTED';
      
      if (isConnectionError) {
        console.log(`⚠️ Повтор запроса, осталось попыток: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryRequest(fn, retries - 1, delay * 2); // Экспоненциальная задержка
      }
    }
    throw error;
  }
}

export interface TimeframeIndicators {
  timeframe: number;
  ema9: string;
  ema20: string;
  ema100: string;
  vwap: string;
  macdHistogram: string;
  supertrend: string;
  trend?: "up" | "down";
}

export interface TokenData {
  token: string;
  price: string;
  indicators: {
    tf3: TimeframeIndicators;
    tf15: TimeframeIndicators;
    tf60: TimeframeIndicators;
    tf240: TimeframeIndicators;
  };
}

/* Получаем последнюю цену токена */
async function getLastPrice(symbol: string): Promise<string> {
  return retryRequest(async () => {
    try {
      const res = await axiosInstance.get(`${BYBIT_BASE_URL}/v5/market/tickers`, {
        params: { category: "linear", symbol }
      });
      return res.data.result.list[0].lastPrice;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400 || error.response?.status === 404) {
          return "0";
        }
      }
      throw error;
    }
  });
}

/* Получаем свечи для расчета индикаторов */
async function getKlines(symbol: string, interval: number, limit: number = 200) {
  return retryRequest(async () => {
    try {
      const res = await axiosInstance.get(`${BYBIT_BASE_URL}/v5/market/kline`, {
        params: { category: "linear", symbol, interval, limit }
      });
      return res.data.result.list || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Если токен не найден или нет данных
        if (error.response?.status === 400 || error.response?.status === 404) {
          return [];
        }
      }
      throw error;
    }
  });
}

/* Расчет ATR для Supertrend */
function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const tr: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));
  }
  
  const atr: number[] = [];
  let sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
  atr.push(sum / period);
  
  for (let i = period; i < tr.length; i++) {
    sum = atr[atr.length - 1] * (period - 1) + tr[i];
    atr.push(sum / period);
  }
  
  return atr;
}

/* Расчет Supertrend */
function calculateSupertrend(highs: number[], lows: number[], closes: number[]): { value: string; trend: "up" | "down" } {
  try {
    const period = 10;
    const multiplier = 3;
    
    if (highs.length < period || lows.length < period || closes.length < period) {
      return { value: "N/A", trend: "up" };
    }
    
    const atr = calculateATR(highs, lows, closes, period);
    if (atr.length === 0) return { value: "N/A", trend: "up" };
    
    const lastIndex = Math.min(highs.length, lows.length, closes.length) - 1;
    const hl2 = (highs[lastIndex] + lows[lastIndex]) / 2;
    
    const upperBand = hl2 + multiplier * atr[atr.length - 1];
    const lowerBand = hl2 - multiplier * atr[atr.length - 1];
    
    const trend = closes[lastIndex] > lowerBand ? "up" : "down";
    const value = trend === "up" ? lowerBand : upperBand;
    
    return { value: value.toFixed(6), trend };
  } catch {
    return { value: "N/A", trend: "up" };
  }
}

/* Расчет всех индикаторов для одного ТФ */
function calculateIndicatorsForTimeframe(closes: number[], klines: any[], timeframe: number): TimeframeIndicators {
  const baseIndicator: TimeframeIndicators = {
    timeframe,
    ema9: "N/A",
    ema20: "N/A",
    ema100: "N/A",
    vwap: "N/A",
    macdHistogram: "N/A",
    supertrend: "N/A",
    trend: "up"
  };
  
  if (closes.length < 100 || klines.length < 100) {
    return baseIndicator;
  }
  
  try {
    // EMA
    const ema9 = EMA.calculate({ period: 9, values: closes });
    const ema20 = EMA.calculate({ period: 20, values: closes });
    const ema100 = EMA.calculate({ period: 100, values: closes });
    
    if (!ema9.length || !ema20.length || !ema100.length) {
      return baseIndicator;
    }
    
    // MACD
    const macd = new MACD({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }).getResult();
    
    // VWAP
    let tpv = 0;
    let volumeSum = 0;
    let validKlines = 0;
    
    for (const k of klines) {
      if (k.length < 6) continue;
      
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      const close = parseFloat(k[4]);
      const volume = parseFloat(k[5]);
      
      if (isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) {
        continue;
      }
      
      const tp = (high + low + close) / 3;
      tpv += tp * volume;
      volumeSum += volume;
      validKlines++;
    }
    
    // Supertrend
    const highs: number[] = [];
    const lows: number[] = [];
    
    for (const k of klines) {
      if (k.length >= 4) {
        const high = parseFloat(k[2]);
        const low = parseFloat(k[3]);
        if (!isNaN(high) && !isNaN(low)) {
          highs.push(high);
          lows.push(low);
        }
      }
    }
    
    const supertrendResult = calculateSupertrend(highs, lows, closes);
    
    return {
      timeframe,
      ema9: ema9[ema9.length - 1]?.toFixed(6) || "N/A",
      ema20: ema20[ema20.length - 1]?.toFixed(6) || "N/A",
      ema100: ema100[ema100.length - 1]?.toFixed(6) || "N/A",
      vwap: validKlines > 0 && volumeSum > 0 ? (tpv / volumeSum).toFixed(6) : "N/A",
      macdHistogram: macd[macd.length - 1]?.histogram?.toFixed(6) || "N/A",
      supertrend: supertrendResult.value,
      trend: supertrendResult.trend
    };
  } catch (error) {
    console.error(`Ошибка расчета индикаторов для TF ${timeframe}:`, error instanceof Error ? error.message : error);
    return baseIndicator;
  }
}

/* Основная функция - сбор данных по одному токену */
export async function collectTokenData(token: string): Promise<TokenData | null> {
  try {
    // Делаем запросы последовательно, а не параллельно, чтобы снизить нагрузку
    const price = await getLastPrice(token);
    if (price === "0") return null;
    
    // Собираем свечи последовательно с задержками
    const klines3 = await getKlines(token, 3);
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
    
    const klines15 = await getKlines(token, 15);
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
    
    const klines60 = await getKlines(token, 60);
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
    
    const klines240 = await getKlines(token, 240);
    
    // Проверяем что есть достаточно данных
    if (klines3.length < 100 || klines15.length < 100 || klines60.length < 100 || klines240.length < 100) {
      return null;
    }
    
    const closes3 = klines3.map((k: any) => parseFloat(k[4])).filter((n:any) => !isNaN(n));
    const closes15 = klines15.map((k: any) => parseFloat(k[4])).filter((n:any) => !isNaN(n));
    const closes60 = klines60.map((k: any) => parseFloat(k[4])).filter((n:any) => !isNaN(n));
    const closes240 = klines240.map((k: any) => parseFloat(k[4])).filter((n:any) => !isNaN(n));
    
    if (closes3.length < 100 || closes15.length < 100 || closes60.length < 100 || closes240.length < 100) {
      return null;
    }
    
    const indicators = {
      tf3: calculateIndicatorsForTimeframe(closes3, klines3, 3),
      tf15: calculateIndicatorsForTimeframe(closes15, klines15, 15),
      tf60: calculateIndicatorsForTimeframe(closes60, klines60, 60),
      tf240: calculateIndicatorsForTimeframe(closes240, klines240, 240)
    };
    
    return { token, price, indicators };
    
  } catch (error) {
    // Тихий fail для проблемных токенов
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        console.log(`⚠️ Rate limit для ${token}, пропускаем...`);
      }
    }
    return null;
  }
}

/* Основная экспортная функция - сбор по всем токенам */
export async function collectAllTokensData(tokens: string[]): Promise<TokenData[]> {
  const results: TokenData[] = [];
  const batchSize = 5; // Обрабатываем по 5 токенов за раз
  const delayBetweenBatches = 2000; // 2 секунды между батчами
  
  console.log(`🔄 Собираем данные для ${tokens.length} токенов...`);
  
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    console.log(`📊 Батч ${Math.floor(i/batchSize) + 1}/${Math.ceil(tokens.length/batchSize)}: ${batch.join(', ')}`);
    
    const batchPromises = batch.map(async (token, index) => {
      // Распределяем запросы во времени внутри батча
      await new Promise(resolve => setTimeout(resolve, index * REQUEST_DELAY * 2));
      
      try {
        const tokenData = await collectTokenData(token);
        if (tokenData) {
          results.push(tokenData);
          console.log(`✅ ${token} - OK`);
        } else {
          console.log(`⚠️ ${token} - нет данных`);
        }
        return tokenData;
      } catch (error) {
        console.log(`❌ ${token} - ошибка:`, error instanceof Error ? error.message : 'Unknown error');
        return null;
      }
    });
    
    await Promise.all(batchPromises);
    
    // Задержка между батчами
    if (i + batchSize < tokens.length) {
      console.log(`⏳ Задержка ${delayBetweenBatches/1000} секунд между батчами...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  console.log(`✅ Собрано данных для ${results.length}/${tokens.length} токенов`);
  return results;
}