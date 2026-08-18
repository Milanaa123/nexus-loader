#!/usr/bin/env python3
import json, os, pathlib, shutil, subprocess, sys, urllib.request, urllib.error, zipfile

ROOT=pathlib.Path.home()/"storage/downloads/Stardew_RU_Mega_Modpack"
RAW=ROOT/"downloads"; MODS=ROOT/"Mods"; STATE=ROOT/"state.json"
for p in (ROOT,RAW,MODS): p.mkdir(parents=True,exist_ok=True)

def save_state(x): STATE.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding="utf-8")
def load_state():
    try:return json.loads(STATE.read_text(encoding="utf-8"))
    except:return {"done":[],"failed":[]}

def api(url,key):
    r=urllib.request.Request(url,headers={"apikey":key,"User-Agent":"stardew-ru-android-loader/0.1"})
    with urllib.request.urlopen(r,timeout=60) as x:return json.load(x)

def validate(key): return api("https://api.nexusmods.com/v1/users/validate.json",key)

def choose_main(files):
    fs=[f for f in files if f.get("category_name")=="MAIN" or f.get("category_id")==1]
    fs=[f for f in fs if "android" not in (str(f.get("name",""))+str(f.get("file_name",""))+str(f.get("description",""))).lower()] or fs
    fs.sort(key=lambda f:(bool(f.get("is_primary")),f.get("uploaded_timestamp",0)),reverse=True)
    return fs[0] if fs else None

def download(url,dst):
    tmp=dst.with_suffix(dst.suffix+".part")
    urllib.request.urlretrieve(url,tmp); tmp.replace(dst)

def unpack(src):
    target=MODS/src.stem; target.mkdir(parents=True,exist_ok=True)
    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:z.extractall(target)
    else: shutil.copy2(src,target/src.name)

def main():
    print("Stardew RU Mega Modpack — Android local loader")
    key=os.environ.get("NEXUS_API_KEY") or input("Вставьте Personal API Key Nexus (ввод только локально на телефоне): ").strip()
    u=validate(key)
    if not u.get("is_premium"): raise SystemExit("Nexus Premium не подтверждён.")
    print("Nexus Premium подтверждён.")
    manifest=pathlib.Path(__file__).with_name("queue.json")
    if not manifest.exists(): raise SystemExit("queue.json пока не создан рядом с loader.py")
    q=json.loads(manifest.read_text(encoding="utf-8")); st=load_state(); done=set(st.get("done",[]))
    total=len(q); print(f"Очередь: {total}")
    for i,item in enumerate(q,1):
        mid=int(item["modId"])
        if mid in done: print(f"[{i}/{total}] {mid}: уже скачан"); continue
        try:
            pack=api(f"https://api.nexusmods.com/v1/games/stardewvalley/mods/{mid}/files.json",key)
            f=choose_main(pack.get("files",[]))
            if not f: raise RuntimeError("MAIN file не найден")
            fid=int(f["file_id"]); links=api(f"https://api.nexusmods.com/v1/games/stardewvalley/mods/{mid}/files/{fid}/download_link.json",key)
            uri=next((x.get("URI") or x.get("uri") for x in links if x.get("URI") or x.get("uri")),None)
            if not uri: raise RuntimeError("нет download URI")
            name=f.get("file_name") or f"{mid}-{fid}.zip"; dst=RAW/name
            print(f"[{i}/{total}] скачиваю {name}")
            if not dst.exists(): download(uri,dst)
            unpack(dst); done.add(mid); st["done"]=sorted(done); save_state(st)
        except Exception as e:
            print(f"  ОШИБКА: {e}"); st.setdefault("failed",[]).append({"modId":mid,"error":str(e)}); save_state(st)
    out=ROOT/"Stardew_RU_Mega_Modpack.zip"
    print("Создаю итоговый ZIP...")
    shutil.make_archive(str(out.with_suffix("")),"zip",ROOT,"Mods")
    print("ГОТОВО:",out)
if __name__=="__main__": main()
