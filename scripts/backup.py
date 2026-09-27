#!/usr/bin/env python3
"""
Skrip Sandaran Lengkap Aplikasi Khairat Kematian Gong Badak
Menghasilkan fail arkib .ZIP bagi keseluruhan kod sumber dan pangkalan data.
"""

import os
import sys
import zipfile
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
now = datetime.now()
timestamp = now.strftime("%Y%m%d_%H%M%S")
zip_filename = f"backup_khairat_gong_badak_{timestamp}.zip"
zip_filepath = os.path.join(ROOT_DIR, zip_filename)
latest_zip_filepath = os.path.join(ROOT_DIR, "khairat_backup_lengkap.zip")

print("=" * 55)
print(" MEMULAKAN PROSES SANDARAN PENUH APLIKASI (FULL BACKUP)")
print(" Pertubuhan Khairat Kematian Gong Badak")
print("=" * 55)
print(f"Masa Sandaran  : {now.strftime('%d/%m/%Y %H:%M:%S')}")
print(f"Nama Fail ZIP  : {zip_filename}\n")

items_to_include = [
    'src',
    'assets',
    'scripts',
    'index.html',
    'vite.config.ts',
    'tsconfig.json',
    'package.json',
    'server.ts',
    'metadata.json',
    '.env.example',
    '.gitignore',
    'db_state.json',
    'PANDUAN_PEMULIHAN.md',
    'backup.sh'
]

# Check database
db_path = os.path.join(ROOT_DIR, 'db_state.json')
if os.path.exists(db_path):
    size_kb = os.path.getsize(db_path) / 1024
    print(f"[INFO PANGKALAN DATA] db_state.json sedia ada ({size_kb:.1f} KB)\n")
else:
    print("AMARAN: db_state.json tidak dijumpai.")

with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for item in items_to_include:
        item_path = os.path.join(ROOT_DIR, item)
        if not os.path.exists(item_path):
            continue
        
        if os.path.isdir(item_path):
            print(f" [+] Menambah direktori : {item}/")
            for root, dirs, files in os.walk(item_path):
                # Filter out node_modules or dist if accidentally inside
                dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist')]
                for file in files:
                    file_full = os.path.join(root, file)
                    arcname = os.path.relpath(file_full, ROOT_DIR)
                    zipf.write(file_full, arcname)
        else:
            print(f" [+] Menambah fail      : {item}")
            zipf.write(item_path, item)

# Create copy as khairat_backup_lengkap.zip
import shutil
shutil.copyfile(zip_filepath, latest_zip_filepath)

final_size = os.path.getsize(zip_filepath)
size_mb = final_size / (1024 * 1024)
size_kb = final_size / 1024

print("-" * 55)
print(" STATUS: SANDARAN BERJAYA DILENGKAPKAN!")
print(f" Saiz Arkib  : {size_mb:.2f} MB ({size_kb:.1f} KB)")
print(f" Lokasi Fail : {zip_filepath}")
print(f" Salinan Tetap: {latest_zip_filepath}")
print("-" * 55)
print("Untuk memulihkan (restore) di komputer baharu:")
print(" 1. Ekstrak fail zip ini ke folder baru.")
print(" 2. Buka terminal dalam folder tersebut dan taip: npm install")
print(" 3. Lancarkan dengan arahan: npm run dev")
print("=" * 55)
