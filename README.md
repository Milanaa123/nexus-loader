# Nexus Loader

Автоматизированный инструмент для подготовки русифицированных модов Stardew Valley.

## Возможности

- импорт списка модов из TXT/CSV;
- поиск модов через Nexus API;
- проверка автора;
- поиск русификаторов;
- скачивание файлов;
- сборка итогового `*_RU.zip`;
- отслеживание статусов обработки.

## Pipeline

```
Input TXT/CSV
   ↓
Import
   ↓
Nexus Search
   ↓
Translation Search
   ↓
Download
   ↓
Validate
   ↓
Build RU Archive
   ↓
Ready ZIP
```

## Запуск

Требуется Node.js >= 20.

```bash
npm install
npm start
```

Worker:

```bash
npm run worker
```

## Переменные окружения

`NEXUS_API_KEY` хранится только в окружении сервера и не добавляется в репозиторий.

## Статусы

Используются состояния:

- found
- multiple_matches
- translation_found
- translation_missing
- original_downloaded
- translation_downloaded
- built
- error

## Разработка

Проверочный smoke-test:

```bash
node tests/pipeline-smoke-test.js
```
