"""All emitted production chunks; gzip matches the audit's deterministic method."""
import gzip
import json
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parents[3]
dist = root / 'apps/apex-os/dist'
entry = re.search(r'<script[^>]*src="([^"]+)"', (dist / 'index.html').read_text()).group(1).split('/')[-1]
assets = [{'path': str(p.relative_to(dist)), 'bytes': p.stat().st_size,
           'gzip_bytes': len(gzip.compress(p.read_bytes(), mtime=0)),
           'html_entry': p.name == entry}
          for p in sorted((dist / 'assets').glob('*')) if p.suffix in ['.js', '.css']]
js = [a for a in assets if a['path'].endswith('.js')]
print(json.dumps({'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
                  'source': 'production staff build; all emitted chunks, not initial transfer',
                  'assets': assets, 'total_js_bytes': sum(a['bytes'] for a in js),
                  'total_js_gzip_bytes': sum(a['gzip_bytes'] for a in js)}, indent=2))
