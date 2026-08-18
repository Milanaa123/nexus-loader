#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo '=== Stardew RU Mega Modpack: Android bootstrap ==='
pkg update -y
pkg install -y python git curl unzip zip
termux-setup-storage || true
mkdir -p "$HOME/stardew-ru-loader" "$HOME/storage/downloads/Stardew_RU_Mega_Modpack"
cp -f "$(dirname "$0")/loader.py" "$HOME/stardew-ru-loader/loader.py" 2>/dev/null || true
printf '\nBootstrap installed.\nNext: python ~/stardew-ru-loader/loader.py\n'
