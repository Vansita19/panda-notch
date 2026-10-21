#!/bin/zsh
# Quit Panda first. This changes only personal UI assets, never its signed bundle or saved state.
set -eu
cd "$(dirname "$0")/.."
python3 - <<'PY'
from pathlib import Path
import os,shutil,tempfile
source=Path('dist').resolve()
for name in ('index.html','app.js','app.css','audio/reminder.wav','audio/select.wav'):
    if not (source/name).is_file(): raise SystemExit('Build the complete frontend first: missing '+name)
folder=Path(os.environ.get('PANDA_DATA_DIR',str(Path.home()/'Library/Application Support/Panda')))
folder.mkdir(parents=True,exist_ok=True)
stage=Path(tempfile.mkdtemp(prefix='Web-stage-',dir=folder))
shutil.copytree(source,stage,dirs_exist_ok=True)
current=folder/'Web';backup=folder/'Web-previous'
if backup.exists(): shutil.rmtree(backup)
if current.exists(): current.rename(backup)
try: stage.rename(current)
except Exception:
    if backup.exists(): backup.rename(current)
    raise
print('Updated local UI; calendar identity and saved data untouched.')
PY
