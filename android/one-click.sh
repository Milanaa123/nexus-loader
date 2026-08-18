#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo '=== Stardew RU Mega Modpack — one click downloader ==='
pkg update -y
pkg install -y python git curl unzip zip
termux-setup-storage || true
WORK="$HOME/stardew-ru-loader"
mkdir -p "$WORK" "$HOME/storage/downloads/Stardew_RU_Mega_Modpack"
curl -fL "https://raw.githubusercontent.com/Milanaa123/nexus-loader/main/android/loader.py" -o "$WORK/loader.py"
curl -fL "https://raw.githubusercontent.com/Milanaa123/nexus-loader/main/android/queue.json" -o "$WORK/queue.json"
echo
echo 'Запускаю загрузчик. Телефон используется только для скачивания ПК/Steam Deck сборки.'
cd "$WORK"
python loader.py
