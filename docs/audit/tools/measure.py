import pathlib,json,subprocess,gzip,sys
r=pathlib.Path(sys.argv[1]); files=subprocess.check_output(['git','ls-files'],cwd=r,text=True).splitlines()
sources=[r/f for f in files if f.startswith(('apps/','packages/')) and pathlib.Path(f).suffix in ['.ts','.tsx','.astro','.css','.mjs']]
manifest=[r/'package.json']+list(r.glob('apps/*/package.json'))+list(r.glob('packages/*/package.json'))
x={'sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip(),'tracked_files':len(files),'source_files':len(sources),'source_lines':sum(len(p.read_text().splitlines()) for p in sources if p.exists()),'direct_dependency_declarations':sum(len(json.loads(p.read_text()).get(k,{})) for p in manifest for k in ['dependencies','devDependencies']),'bundles':{}}
for app in ['apex-os','designer','website']:
 ps=list((r/f'apps/{app}/dist').rglob('*.js')); x['bundles'][app]={'js_files':len(ps),'bytes':sum(p.stat().st_size for p in ps),'gzip_bytes':sum(len(gzip.compress(p.read_bytes(),mtime=0)) for p in ps)}
x['production_source_lines']=sum(len(p.read_text().splitlines()) for p in sources if p.exists() and '.test.' not in p.name and '/tests/' not in str(p) and '/tests-production/' not in str(p))
print(json.dumps(x,indent=2))
