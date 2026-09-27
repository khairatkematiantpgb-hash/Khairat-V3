#!/usr/bin/env bash

# ==============================================================================
# Skrip Sandaran Lengkap Aplikasi Khairat Kematian Gong Badak
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "======================================================"
echo " Skrip Sandaran Penuh (Full Backup Script)"
echo " Sistem Khairat Kematian Taman Perkasa Gong Badak"
echo "======================================================"

# Check if node is available
if command -v node >/dev/null 2>&1; then
    echo "Menjalankan skrip sandaran melalui Node.js..."
    node scripts/backup.js
elif command -v python3 >/dev/null 2>&1; then
    echo "Menjalankan skrip sandaran melalui Python 3..."
    python3 scripts/backup.py
else
    echo "Ralat: Node.js atau Python3 diperlukan untuk menghasilkan fail zip."
    exit 1
fi
