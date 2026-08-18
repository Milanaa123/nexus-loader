#!/usr/bin/env python3
import json, os, pathlib, shutil, urllib.request, zipfile

ROOT=pathlib.Path.home()/"storage/downloads/Stardew_RU_Mega_Modpack"
RAW=ROOT/"downloads"; MODS=ROOT/"Mods"; STATE=ROOT/"state.json"
for p in (ROOT,RAW,MODS): p.mkdir(parents=True,exist_ok=True)

def save_state(x): STATE.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding="utf-8")
def load_state():
    try:return json.loads(STATE.read_text(encoding="utf-8"))
    except:return {"done":[],"failed":[]}

def api(url,key):
    r=urllib.request.Request(url,headers={"apikey":key,"User-Agent":"stardew-ru-android-loader/0.3"})
    with urllib.request.urlopen(r,timeout=90) as x:return json.load(x)

def validate(key): return api("https://api.nexusmods.com/v1/users/validate.json",key)

def choose_main(files):
    fs=[f for f in files if f.get("category_name")=="MAIN" or f.get("category_id")==1]
    fs=[f for f in fs if "android" not in (str(f.get("name",""))+str(f.get("file_name",""))+str(f.get("description",""))).lower()] or fs
    fs.sort(key=lambda f:(bool(f.get("is_primary")),f.get("uploaded_timestamp",0)),reverse=True)
    return fs[0] if fs else None

def download(url,dst):
    tmp=dst.with_suffix(dst.suffix+".part")
    urllib.request.urlretrieve(url,tmp); tmp.replace(dst)

def unpack(src,target_root):
    target=target_root/src.stem; target.mkdir(parents=True,exist_ok=True)
    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:z.extractall(target)
    else: shutil.copy2(src,target/src.name)

def norm_id(item):
    raw=item.get("mod_id") or item.get("modId")
    return int(raw) if raw else None

def fetch_one(item,key,target_root,label,index,total,done,st):
    if item.get("external"):
        print(f"[{index}/{total}] {label}: пропуск внешней зависимости {item.get('name')}")
        return
    mid=norm_id(item)
    if not mid: raise RuntimeError("нет Nexus mod ID")
    if mid in done:
        print(f"[{index}/{total}] {label} {mid}: уже скачан")
        return
    pack=api(f"https://api.nexusmods.com/v1/games/stardewvalley/mods/{mid}/files.json",key)
    f=choose_main(pack.get("files",[]))
    if not f: raise RuntimeError("MAIN file не найден")
    fid=int(f["file_id"])
    links=api(f"https://api.nexusmods.com/v1/games/stardewvalley/mods/{mid}/files/{fid}/download_link.json",key)
    uri=next((x.get("URI") or x.get("uri") for x in links if x.get("URI") or x.get("uri")),None)
    if not uri: raise RuntimeError("нет download URI")
    name=f.get("file_name") or f"{mid}-{fid}.zip"; dst=RAW/name
    print(f"[{index}/{total}] {label}: скачиваю {name}")
    if not dst.exists(): download(uri,dst)
    unpack(dst,target_root)
    done.add(mid); st["done"]=sorted(done); save_state(st)

def main():
    print("Stardew RU Mega Modpack — Android local loader")
    key=os.environ.get("NEXUS_API_KEY") or input("Вставьте Personal API Key Nexus (ввод только локально на телефоне): ").strip()
    u=validate(key)
    if not u.get("is_premium"): raise SystemExit("Nexus Premium не подтверждён.")
    print("Nexus Premium подтверждён.")
    manifest=pathlib.Path(__file__).with_name("queue.json")
    if not manifest.exists(): raise SystemExit("queue.json не найден рядом с loader.py")
    q=json.loads(manifest.read_text(encoding="utf-8"))
    mods=q.get("mods",q if isinstance(q,list) else [])
    translations=q.get("translations",[]) if isinstance(q,dict) else []
    held=q.get("held_for_review",[]) if isinstance(q,dict) else []
    ru_root=ROOT/"Russian_Translations"; ru_root.mkdir(parents=True,exist_ok=True)
    st=load_state(); done=set(st.get("done",[]))
    jobs=[("MOD",x,MODS) for x in mods]+[("RU",x,ru_root) for x in translations]
    total=len(jobs)
    downloadable=sum(1 for _,x,_ in jobs if not x.get("external"))
    print(f"Очередь: {downloadable} Nexus-файлов; внешних зависимостей: {total-downloadable}")
    if held: print(f"Отложено на проверку: {len(held)}")
    for i,(label,item,target_root) in enumerate(jobs,1):
        try: fetch_one(item,key,target_root,label,i,total,done,st)
        except Exception as e:
            mid=item.get("mod_id") or item.get("modId")
            print(f"  ОШИБКА {mid}: {e}")
            st.setdefault("failed",[]).append({"modId":mid,"name":item.get("name"),"error":str(e)}); save_state(st)
    out=ROOT/"Stardew_RU_Mega_Modpack.zip"
    print("Создаю итоговый ZIP...")
    if out.exists(): out.unlink()
    with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
        for base in (MODS,ru_root):
            for p in base.rglob("*"):
                if p.is_file(): z.write(p,p.relative_to(ROOT))
        if held:
            held_file=ROOT/"HELD_FOR_REVIEW.json"
            held_file.write_text(json.dumps(held,ensure_ascii=False,indent=2),encoding="utf-8")
            z.write(held_file,held_file.relative_to(ROOT))
    print("ГОТОВО:",out)
    if st.get("failed"): print(f"ВНИМАНИЕ: ошибок загрузки: {len(st['failed'])}. Повторный запуск продолжит очередь.")
if __name__=="__main__": main()
