import { parce } from './parcer';
import { collectAllTokensData } from './data-collector';
import { analyzeGlobalTrend } from './globalTrend';
import { filterActiveTokens } from './activeFilter';
import { findTrades, printTradeSignals } from './findTrade';
import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

class SimpleTelegramBot {
  private isEnabled = false;
  private token: string = '';
  private chatId: string = '';
  
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    
    console.log('🔧 Проверка настроек Telegram:');
    console.log(`   Токен: ${this.token ? '***указан***' : 'НЕТ'}`);
    console.log(`   Chat ID: ${this.chatId || 'НЕТ'}`);
    
    if (this.token && this.chatId && this.token !== 'YOUR_TELEGRAM_BOT_TOKEN') {
      this.isEnabled = true;
      console.log('✅ Телеграм бот инициализирован');
      console.log(`✅ Chat ID установлен: ${this.chatId}`);
    } else {
      console.log('⚠️ Токен телеграм бота не указан, уведомления отключены');
      
      if (!this.token) {
        console.log('💡 Создайте бота через @BotFather и получите токен');
      }
      if (!this.chatId) {
        console.log('💡 Получите chat_id написав боту сообщение');
      }
    }
  }
  
  async sendNotification(message: string): Promise<void> {
    if (!this.isEnabled) {
      console.log('📱 Телеграм отключен, сообщение не отправлено:', message.substring(0, 50) + '...');
      return;
    }
    
    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      
      console.log(`📱 Отправка в Telegram: ${message.substring(0, 30)}...`);
      
      const response = await axios.post(url, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown'
      });
      
      if (response.data.ok) {
        console.log('✅ Уведомление отправлено в Telegram');
      } else {
        console.error('❌ Ошибка Telegram API:', response.data.description);
      }
    } catch (error: any) {
      console.error('❌ Ошибка отправки в Telegram:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else {
        console.error('Message:', error.message);
      }
    }
  }
  
  getStatus(): string {
    return this.isEnabled ? '✅ Включен' : '❌ Отключен';
  }
}

class TradingBot {
  private tokens: string[] = [];
  private tokenData: any[] = [];
  private activeTokens: any = {
    activeBullish: [],
    activeBearish: []
  };
  
  // Интервалы в миллисекундах
  private tokenUpdateInterval = 6 * 60 * 60 * 1000; // 6 часов
  private dataUpdateInterval = 10 * 60 * 1000; // 10 минут
  private tradeCheckInterval = 30 * 1000; // 30 секунд
  private telegramNotifyInterval = 2 * 60 * 1000; // 2 минуты
  
  private isRunning = false;
  private telegramBot: SimpleTelegramBot;
  
  constructor() {
    console.log('\n🔧 Инициализация TradingBot...');
    this.telegramBot = new SimpleTelegramBot();
  }
  
  // 1. Обновление списка токенов
  private async updateTokenList(): Promise<void> {
    try {
      console.log('\n🔄 Обновляем список токенов...');
      this.tokens = await parce();
      console.log(`✅ Получено ${this.tokens.length} токенов`);
    } catch (error: any) {
      console.error('❌ Ошибка при обновлении токенов:', error.message);
    }
  }
  
  // 2. Обновление данных
  private async updateTokenData(): Promise<void> {
    try {
      if (this.tokens.length === 0) {
        console.log('⚠️ Список токенов пуст, пропускаем обновление данных');
        return;
      }
      
      console.log('\n📊 Обновляем данные по токенам...');
      
      // Ограничиваем количество токенов для обработки
      const tokensToProcess = this.tokens.slice(0, 50);
      
      this.tokenData = await collectAllTokensData(tokensToProcess);
      
      if (this.tokenData.length === 0) {
        console.log('⚠️ Не удалось собрать данные ни по одному токену');
        return;
      }
      
      // Анализируем глобальный тренд
      const globalTrend = analyzeGlobalTrend(this.tokenData);
      
      // Фильтруем активные токены
      this.activeTokens = filterActiveTokens(
        globalTrend.bullishTokens,
        globalTrend.bearishTokens
      );
      
      const totalActive = this.activeTokens.activeBullish.length + this.activeTokens.activeBearish.length;
      console.log(`✅ Данные обновлены. Активных: ${totalActive}`);
      
    } catch (error: any) {
      console.error('❌ Критическая ошибка при обновлении данных:', error.message);
    }
  }
  
  // 3. Поиск сделок
  private async checkForTrades(): Promise<void> {
    try {
      const totalActive = this.activeTokens.activeBullish.length + this.activeTokens.activeBearish.length;
      
      if (totalActive === 0) {
        return;
      }
      
      console.log('\n🔍 Поиск торговых сигналов...');
      
      const signals = findTrades(this.activeTokens);
      
      if (signals.length === 0) {
        console.log('📭 Торговых сигналов не найдено');
      } else {
        printTradeSignals(signals);
        
        // Отправляем сигналы в телеграм
        await this.sendTelegramNotification(signals, 'Торговые сигналы');
      }
      
    } catch (error: any) {
      console.error('❌ Ошибка при поиске сделок:', error.message);
    }
  }
  
  // Отправка уведомления в телеграм
  private async sendTelegramNotification(signals: any[], type: string = 'Обновление'): Promise<void> {
    try {
      const totalActive = this.activeTokens.activeBullish.length + this.activeTokens.activeBearish.length;
      const totalSignals = signals.length;
      
      // Формируем сообщение
      let message = `📈 *${type.toUpperCase()} Trading Bot*\n\n`;
      message += `⏰ *${new Date().toLocaleTimeString()}*\n\n`;
      
      // Активные токены
      message += `*Активные токены:*\n`;
      message += `📈 Бычьих: ${this.activeTokens.activeBullish.length}\n`;
      message += `📉 Медвежьих: ${this.activeTokens.activeBearish.length}\n`;
      message += `🎯 Всего: ${totalActive}\n\n`;
      
      // Сделки
      if (totalSignals > 0) {
        message += `*Колы на сделку:*\n`;
        
        signals.forEach((signal: any, index: number) => {
          const emoji = signal.direction === 'LONG' ? '📈' : '📉';
          const direction = signal.direction === 'LONG' ? 'ЛОНГ' : 'ШОРТ';
          const price = parseFloat(signal.price).toFixed(4);
          
          message += `${emoji} *${signal.token}*: ${direction} ${signal.timeframe}м\n`;
          message += `   Цена: $${price}\n`;
          
          if (index < signals.length - 1) {
            message += '\n';
          }
        });
      } else {
        message += `*Колы на сделку:*\n`;
        message += `📭 Сигналов нет\n`;
      }
      
      await this.telegramBot.sendNotification(message);
      
    } catch (error: any) {
      console.error('❌ Ошибка отправки в Telegram:', error.message);
    }
  }
  
  // Регулярное обновление в телеграм
  private async sendRegularTelegramUpdate(): Promise<void> {
    try {
      const totalActive = this.activeTokens.activeBullish.length + this.activeTokens.activeBearish.length;
      
      if (totalActive > 0) {
        await this.sendTelegramNotification([], 'Регулярное обновление');
      }
    } catch (error: any) {
      console.error('❌ Ошибка отправки регулярного обновления в Telegram:', error.message);
    }
  }
  
  // 4. Запуск бота
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Бот уже запущен');
      return;
    }
    
    this.isRunning = true;
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 ЗАПУСК ТОРГОВОГО БОТА');
    console.log('='.repeat(60));
    console.log(`📱 Телеграм уведомления: ${this.telegramBot.getStatus()}`);
    console.log('='.repeat(60));
    
    try {
      // Отправляем уведомление о запуске
      const startMessage = `✅ *Trading Bot ЗАПУЩЕН*\n\n` +
                          `⏰ ${new Date().toLocaleTimeString()}\n\n` +
                          `Бот успешно запущен и начал мониторинг.`;
      await this.telegramBot.sendNotification(startMessage);
      
      // Первоначальная загрузка
      await this.updateTokenList();
      
      if (this.tokens.length > 0) {
        await this.updateTokenData();
      }
      
      // Настраиваем интервалы
      const tokenTimer = setInterval(() => this.updateTokenList(), this.tokenUpdateInterval);
      const dataTimer = setInterval(() => this.updateTokenData(), this.dataUpdateInterval);
      const tradeTimer = setInterval(() => this.checkForTrades(), this.tradeCheckInterval);
      const telegramTimer = setInterval(() => this.sendRegularTelegramUpdate(), this.telegramNotifyInterval);
      
      // Сохраняем таймеры для очистки
      const timers = [tokenTimer, dataTimer, tradeTimer, telegramTimer];
      
      // Обработка остановки
      const cleanup = () => {
        timers.forEach(timer => clearInterval(timer));
      };
      
      process.on('SIGINT', async () => {
        cleanup();
        await this.stop('Ручная остановка пользователем');
        process.exit(0);
      });
      
      console.log('\n✅ Бот успешно запущен!');
      console.log(`📋 Токены обновляются: каждые 6 часов`);
      console.log(`📊 Данные обновляются: каждые 10 минут`);
      console.log(`🔍 Поиск сделок: каждые 30 секунд`);
      console.log(`📱 Telegram обновления: каждые 2 минуты`);
      console.log('\n' + '='.repeat(60));
      
    } catch (error: any) {
      console.error('❌ Ошибка при запуске бота:', error.message);
      await this.stop('Ошибка при запуске: ' + error.message);
    }
  }
  
  // 5. Остановка бота
  async stop(reason?: string): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('\n🛑 Остановка бота...');
    
    // Отправляем уведомление об остановке
    const stopMessage = `🛑 *Trading Bot ОСТАНОВЛЕН*\n\n` +
                       `⏰ ${new Date().toLocaleTimeString()}\n\n` +
                       (reason ? `Причина: ${reason}\n\n` : '') +
                       `⚠️ *ВНИМАНИЕ: Бот не работает!*\n` +
                       `Проверьте консоль и перезапустите.`;
    
    await this.telegramBot.sendNotification(stopMessage);
    
    console.log('✅ Бот остановлен');
  }
  
  // 6. Получить текущую статистику
  getStats(): any {
    return {
      totalTokens: this.tokens.length,
      tokenDataCount: this.tokenData.length,
      activeBullish: this.activeTokens.activeBullish?.length || 0,
      activeBearish: this.activeTokens.activeBearish?.length || 0,
      lastUpdate: new Date().toLocaleString()
    };
  }
}

// Запуск бота
async function main() {
  console.log('⚡ Инициализация приложения...');
  
  const bot = new TradingBot();
  
  // Обработка необработанных исключений
  process.on('uncaughtException', async (error: Error) => {
    console.error('\n🚨 Необработанное исключение:', error.message);
    await bot.stop(`Аварийная остановка: ${error.message}`);
    
    // Перезапуск через 2 минуты
    console.log('\n🔄 Перезапуск бота через 2 минуты...');
    setTimeout(() => {
      console.log('\n🔄 ПЕРЕЗАПУСК БОТА...');
      main().catch(console.error);
    }, 2 * 60 * 1000);
  });
  
  // Обработка необработанных промисов
  process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
    console.error('\n🚨 Необработанный rejection:', reason);
    await bot.stop('Unhandled Promise Rejection');
    
    console.log('\n🔄 Перезапуск через 3 минуты...');
    setTimeout(() => {
      console.log('\n🔄 ПЕРЕЗАПУСК...');
      main().catch(console.error);
    }, 3 * 60 * 1000);
  });
  
  // Запуск
  await bot.start();
  
  // Периодический вывод статистики
  setInterval(() => {
    const stats = bot.getStats();
    console.log(`\n📈 Статистика: Токенов: ${stats.totalTokens}, Активных: ${stats.activeBullish + stats.activeBearish}`);
  }, 5 * 60 * 1000);
}

// Запускаем
if (require.main === module) {
  console.log('='.repeat(60));
  console.log('🤖 TRADING BOT STARTING');
  console.log('='.repeat(60));
  
  // Проверяем .env файл
  const fs = require('fs');
  if (fs.existsSync('.env')) {
    console.log('✅ .env файл найден');
  } else {
    console.log('⚠️ .env файл не найден в корне проекта');
    console.log('💡 Создайте файл .env с переменными:');
    console.log('   TELEGRAM_BOT_TOKEN=ваш_токен');
    console.log('   TELEGRAM_CHAT_ID=ваш_chat_id');
  }
  
  // Небольшая задержка перед запуском
  setTimeout(() => {
    main().catch(async (error: Error) => {
      console.error('💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
      process.exit(1);
    });
  }, 1000);
}