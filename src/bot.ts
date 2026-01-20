import TelegramBot from 'node-telegram-bot-api';

export class NotificationBot {
  private bot: TelegramBot | null = null;
  private chatId: string | null = null;
  private isEnabled = false;
  private botName: string = 'Trading Bot';
  
  constructor(token: string, botName?: string) {
    if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
      console.log('⚠️ Токен телеграм бота не указан, уведомления отключены');
      return;
    }
    
    try {
      this.bot = new TelegramBot(token, { polling: false });
      this.isEnabled = true;
      this.botName = botName || 'Trading Bot';
      console.log('✅ Телеграм бот инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации телеграм бота:', error);
    }
  }
  
  // Установить chatId для отправки сообщений
  setChatId(chatId: string): void {
    this.chatId = chatId;
    console.log(`✅ Chat ID установлен: ${chatId}`);
  }
  
  // Уведомление об активных токенах и сделках
  async sendTradeNotification(
    activeTokens: { activeBullish: any[], activeBearish: any[] },
    tradeSignals: any[]
  ): Promise<void> {
    if (!this.isEnabled || !this.bot || !this.chatId) {
      return;
    }
    
    try {
      const totalActive = activeTokens.activeBullish.length + activeTokens.activeBearish.length;
      const totalSignals = tradeSignals.length;
      
      // Формируем сообщение
      let message = `📈 *ОБНОВЛЕНИЕ ${this.botName}*\n\n`;
      message += `⏰ *${new Date().toLocaleTimeString()}*\n\n`;
      
      // Активные токены
      message += `*Активные токены:*\n`;
      message += `📈 Бычьих: ${activeTokens.activeBullish.length}\n`;
      message += `📉 Медвежьих: ${activeTokens.activeBearish.length}\n`;
      message += `🎯 Всего: ${totalActive}\n\n`;
      
      // Сделки
      if (totalSignals > 0) {
        message += `*Колы на сделку:*\n`;
        
        tradeSignals.forEach((signal: any, index: number) => {
          const emoji = signal.direction === 'LONG' ? '📈' : '📉';
          const direction = signal.direction === 'LONG' ? 'ЛОНГ' : 'ШОРТ';
          const price = parseFloat(signal.price).toFixed(4);
          
          message += `${emoji} *${signal.token}*: ${direction} ${signal.timeframe}м\n`;
          message += `   Цена: $${price}\n`;
          
          if (index < tradeSignals.length - 1) {
            message += '\n';
          }
        });
      } else {
        message += `*Колы на сделку:*\n`;
        message += `📭 Сигналов нет\n`;
      }
      
      // Отправляем сообщение
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown' as any,
        disable_notification: totalSignals === 0
      });
      
      console.log('✅ Уведомление отправлено в Telegram');
      
    } catch (error: any) {
      console.error('❌ Ошибка отправки в Telegram:', error);
    }
  }
  
  // Уведомление об остановке бота
  async sendBotStoppedNotification(reason?: string): Promise<void> {
    if (!this.isEnabled || !this.bot || !this.chatId) {
      return;
    }
    
    try {
      const message = `🛑 *${this.botName} ОСТАНОВЛЕН*\n\n` +
                     `⏰ ${new Date().toLocaleTimeString()}\n\n` +
                     (reason ? `Причина: ${reason}\n\n` : '') +
                     `⚠️ *ВНИМАНИЕ: Бот не работает!*\n` +
                     `Проверьте консоль и перезапустите.`;
      
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown' as any,
        disable_notification: false // Всегда с уведомлением!
      });
      
      console.log('✅ Уведомление об остановке отправлено в Telegram');
      
    } catch (error: any) {
      console.error('❌ Ошибка отправки уведомления об остановке:', error);
    }
  }
  
  // Уведомление о запуске бота
  async sendBotStartedNotification(): Promise<void> {
    if (!this.isEnabled || !this.bot || !this.chatId) {
      return;
    }
    
    try {
      const message = `✅ *${this.botName} ЗАПУЩЕН*\n\n` +
                     `⏰ ${new Date().toLocaleTimeString()}\n\n` +
                     `Бот успешно запущен и начал мониторинг.`;
      
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown' as any
      });
      
      console.log('✅ Уведомление о запуске отправлено в Telegram');
      
    } catch (error: any) {
      console.error('❌ Ошибка отправки уведомления о запуске:', error);
    }
  }
  
  // Простое сообщение
  async sendMessage(text: string, silent: boolean = false): Promise<void> {
    if (!this.isEnabled || !this.bot || !this.chatId) {
      return;
    }
    
    try {
      await this.bot.sendMessage(this.chatId, text, {
        disable_notification: silent
      });
    } catch (error: any) {
      console.error('❌ Ошибка отправки сообщения в Telegram:', error);
    }
  }
  
  // Проверить состояние
  getStatus(): string {
    return this.isEnabled ? '✅ Включен' : '❌ Отключен';
  }
}

// Создать экземпляр бота
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_NAME = process.env.BOT_NAME || 'Trading Bot';
export const notificationBot = new NotificationBot(TELEGRAM_BOT_TOKEN, BOT_NAME);