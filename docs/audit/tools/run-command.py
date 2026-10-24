import sys,subprocess,time,json,pathlib,os
label=sys.argv[1]; directory=pathlib.Path(sys.argv[2]);directory.mkdir(parents=True,exist_ok=True)
command=sys.argv[3:];start=time.monotonic()
with (directory/(label+'.log')).open('w') as out: result=subprocess.run(command,stdout=out,stderr=subprocess.STDOUT)
data={'command':command,'cwd':os.getcwd(),'sha':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'seconds':round(time.monotonic()-start,3),'exit_code':result.returncode}
(directory/(label+'.json')).write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data));sys.exit(result.returncode)
