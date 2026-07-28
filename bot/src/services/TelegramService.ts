import { Telegraf } from 'telegraf';
import { ApartmentData } from './MonitorService';

export class TelegramService {
  private bot: Telegraf;
  private chatId: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';

    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram features will be disabled.');
      this.bot = new Telegraf('dummy');
      return;
    }

    this.bot = new Telegraf(token);
    this.setupCommands();
  }

  private setupCommands() {
    this.bot.command('status', (ctx) => {
      ctx.reply('📊 *Бот активний*\nЛіміт заявок перевіряється...\nБД підключена.', { parse_mode: 'Markdown' });
    });

    this.bot.command('applications', (ctx) => {
      ctx.reply('📂 *Ваші активні заявки:*\nПоки порожньо.', { parse_mode: 'Markdown' });
    });

    this.bot.command('history', (ctx) => {
      ctx.reply('📜 *Історія:*\nТут будуть останні 5 заявок.', { parse_mode: 'Markdown' });
    });

    this.bot.command('settings', (ctx) => {
      const maxPrice = process.env.FILTER_MAX_PRICE || 'Не задано';
      const minArea = process.env.FILTER_MIN_AREA || 'Не задано';
      const city = process.env.FILTER_CITY || 'Не задано';
      
      ctx.reply(`⚙️ *Поточні фільтри:*\nМісто: ${city}\nМакс ціна: €${maxPrice}\nМін площа: ${minArea}м²`, { parse_mode: 'Markdown' });
    });
  }

  public async start() {
    if (process.env.TELEGRAM_BOT_TOKEN) {
      console.log('Starting Telegram bot...');
      this.bot.launch();
    }
  }

  public async notifyNewApartment(apartment: ApartmentData) {
    if (!this.chatId || !process.env.TELEGRAM_BOT_TOKEN) return;
    
    const message = `✅ *Знайдено нову квартиру*\n\n` +
      `📍 *Адреса:* ${apartment.address}, ${apartment.district}, ${apartment.city}\n` +
      `💶 *Ціна:* €${apartment.price}\n` +
      `📐 *Площа:* ${apartment.area}м²\n` +
      `🚪 *Кімнат:* ${apartment.rooms}\n\n` +
      `🔗 [Відкрити на сайті](${apartment.url})`;

    await this.bot.telegram.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
  }

  public async notifyApplied(apartment: ApartmentData) {
    if (!this.chatId || !process.env.TELEGRAM_BOT_TOKEN) return;
    
    const message = `🎉 *Подано заявку!*\n\n` +
      `📍 *Адреса:* ${apartment.address}\n` +
      `🔗 [Відкрити на сайті](${apartment.url})`;

    await this.bot.telegram.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
  }

  public async notifyError(reason: string) {
    if (!this.chatId || !process.env.TELEGRAM_BOT_TOKEN) return;
    await this.bot.telegram.sendMessage(this.chatId, `❌ *Помилка:*\n${reason}`, { parse_mode: 'Markdown' });
  }
}
