import axios from "axios";

const MONTHS = 30 * 24 * 60 * 60 * 1000 * 3; // 3 месяца

export async function parce(): Promise<string[]> {
  try {
    const res = await axios.get(`https://api.bybit.com/v5/market/instruments-info`, {
      params: { category: "linear" }
    });

    const instruments = res.data.result.list;
    const now = Date.now();

    const tokenList = instruments
      .filter((i: any) => i.status === "Trading")
      .filter((i: any) => {
        const launchTime = Number(i.launchTime);
        return now - launchTime <= MONTHS;
      })
      .filter((i: any) => /^[A-Z]+USDT$/.test(i.symbol))
      .map((i: any) => i.symbol);

    return tokenList;
  } catch (error) {
    console.error('❌ Ошибка при парсинге:', error);
    return [];
  }
}