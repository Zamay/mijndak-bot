# MijnDak Autonomous Bot & Dashboard

Це повністю автоматизована система для пошуку соціального житла на сайті Amsterdam MijnDak, яка працює 24/7, подає заявки, оптимізує позиції в черзі та має веб-дашборд для моніторингу.

## Архітектура та Стек Технологій
Проект розділено на дві частини:
1. **Scraper Bot (`/bot`)**: Node.js скрипт, який використовує Playwright для автоматизації браузера. Працює за розкладом (`node-cron`).
2. **Web Dashboard (`/dashboard`)**: Next.js (App Router, Tailwind CSS) додаток для візуалізації даних.

**Спільна інфраструктура:**
- **База даних**: Firebase Firestore (NoSQL).
- **CI/CD**: GitHub Actions для перевірки збірок, Husky (`pre-push` hook) для локальної перевірки компіляції.
- **Деплой**: Vercel (для дашборда).

---

## Схема Бази Даних (Firebase Firestore)

База даних складається з двох основних колекцій:

### 1. `apartments` (Список всіх знайдених квартир)
- `publicatieId` (String, Document ID): Унікальний ідентифікатор квартири на MijnDak.
- `address` (String, Optional): Адреса.
- `price` (String, Optional): Ціна.
- `rooms` (String, Optional): Кількість кімнат.
- `area` (String, Optional): Площа.
- `type` (String, Optional): Тип (наприклад, Sociale huur).
- `discoveryTime` (Timestamp/Date): Час, коли бот вперше побачив цю квартиру.
- `status` (String): Статус доступності (`AVAILABLE` | `UNAVAILABLE`).

### 2. `applications` (Ваші заявки та відгуки)
- `publicatieId` (String, Document ID): Ідентифікатор квартири.
- `position` (Number): Ваша поточна позиція в черзі (999, якщо ще невідомо).
- `totalCandidates` (Number): Загальна кількість кандидатів.
- `status` (String): Статус вашої заявки:
  - `APPLIED` (Активна заявка, враховується в ліміт)
  - `CANCELLED` (Скасована ботом через погану позицію)
  - `SELECTED` (Вас обрали)
  - `REJECTED` (Квартиру здали іншому)
- `appliedAt` (Timestamp/Date): Дата подачі заявки.
- `updatedAt` (Timestamp/Date): Час останньої перевірки/оновлення статусу.

---

## Логіка роботи бота (Logic Engine)

Бот запускається за розкладом (наприклад, о 00:02, 08:00, 13:00) та виконує наступний цикл (`runLogicCycle` в `bot/index.ts`):

1. **Ініціалізація та Логін**: Піднімає headless-браузер (Playwright), логіниться на MijnDak.
2. **Синхронізація заявок (Reacties)**: Зчитує вкладки `Actueel`, `Lopend`, `Historisch`. Оновлює в БД ваші поточні позиції (`position`) та кількість кандидатів.
3. **Синхронізація квартир (Aanbod)**: Зчитує всі доступні квартири на сайті, записує нові в базу (`apartments`).
4. **Прийняття рішень (Application Logic)**:
   - Максимальний ліміт активних заявок: **2**.
   - Якщо активних заявок **< 2**: Бот миттєво подається на нову знайдену квартиру.
   - Якщо активних заявок **= 2**: Бот перевіряє позиції в активних заявках. 
   - Якщо знайдено заявку з позицією **> 100**, бот:
     1. Скасовує цю заявку на сайті (`Reactie intrekken`).
     2. Позначає її в базі як `CANCELLED`.
     3. Подається на нову доступну квартиру.
   - Якщо всі активні заявки мають хорошу позицію (<= 100), бот ігнорує нові квартири і нічого не скасовує.

---

## Опис основних файлів

### Bot (`/bot`)
- `db.ts`: Модуль підключення до Firebase за допомогою `serviceAccountKey.json`. Містить функції запису (`saveApartment`, `saveApplication`) та логіку пошуку гіршої заявки (`getWorstApplicationToCancel`).
- `scraper.ts`: Клас `MijnDakScraper`. Інкапсулює всю логіку взаємодії з UI сайту (Playwright locator'и, кліки, зчитування таблиць).
- `index.ts`: Ядро логіки. Виконує послідовність дій (Синхронізація -> Прийняття рішень -> Подача/Скасування).
- `scheduler.ts`: Налаштування `node-cron` для автоматичного запуску `index.ts` за розкладом.

### Dashboard (`/dashboard`)
- `src/lib/firebase.ts`: Підключення до Firebase Admin за допомогою змінної оточення `FIREBASE_SERVICE_ACCOUNT`.
- `src/app/page.tsx`: Головна і єдина сторінка (Server Component). Зчитує останні 20 квартир та всі заявки з БД, відмальовує UI (статистика, активні заявки з позиціями, історія, знайдені квартири).

---

## Як розгорнути (Setup)

1. **Локальний запуск бота**:
   ```bash
   cd bot
   npm install
   # Покласти serviceAccountKey.json в папку bot/
   # Створити .env файл в корені проекту з MIJNDAK_USERNAME та MIJNDAK_PASSWORD
   npx tsc --noEmit # Перевірка типів
   npm start # (або npx tsx index.ts для запуску одного циклу)
   ```

2. **Дашборд на Vercel**:
   - Імпортувати репозиторій з GitHub.
   - Root Directory: `dashboard`
   - В Environment Variables додати `FIREBASE_SERVICE_ACCOUNT` із повним JSON вмістом ключа від Firebase.

## Майбутні плани (TODO)
- Інтеграція Telegram-бота (`telegraf`) для миттєвих сповіщень про нові подачі, скасування та успішні матчі (статус `SELECTED`).
- Аналітична сторінка на дашборді (графіки появи квартир за годинами/днями).
- Виділений сервер (або Docker/Cloud Run) для фонової роботи `scheduler.ts` 24/7.
