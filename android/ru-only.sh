#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo '=== Stardew: русификаторы + Tractor Mod ==='
pkg update -y
pkg install -y python curl unzip zip
termux-setup-storage || true
WORK="$HOME/stardew-ru-only"
mkdir -p "$WORK"
curl -fL "https://raw.githubusercontent.com/Milanaa123/nexus-loader/main/android/loader.py" -o "$WORK/loader.py"
curl -fL "https://raw.githubusercontent.com/Milanaa123/nexus-loader/main/android/ru-only-queue.json" -o "$WORK/queue.json"
cd "$WORK"
python loader.py
