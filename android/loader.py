#!/usr/bin/env python3
import json, os, pathlib, shutil, tempfile, urllib.request, zipfile, re

ROOT=pathlib.Path.home()/"storage/downloads/Stardew_RU_Mega_Modpack"
RAW=ROOT/"downloads"; MODS=ROOT/"Mods"; STATE=ROOT/"state.json"
for p in (ROOT,RAW,MODS): p.mkdir(parents=True,exist_ok=True)

def save_state(x): STATE.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding="utf-8")
def load_state():
    try:return json.loads(STATE.read_text(encoding="utf-8"))
    except:return {"done":[],"failed":[]}

def api(url,key):
    r=urllib.request.Request(url,headers={"apikey":key,"User-Agent":"stardew-ru-pc-modpack-loader/0.5"})
    with urllib.request.urlopen(r,timeout=90) as x:return json.load(x)

def validate(key): return api("https://api.nexusmods.com/v1/users/validate.json",key)

def choose_file(files,item):
    fs=[f for f in files if f.get("category_name")=="MAIN" or f.get("category_id")==1]
    wanted=item.get("file_id")
    if wanted:
        exact=[f for f in files if int(f.get("file_id",-1))==int(wanted)]
        if exact:return exact[0]
    version=item.get("source_version")
    if version:
        exact=[f for f in fs if version in str(f.get("version","")) or version in str(f.get("name",""))]
        if exact: fs=exact
    fs.sort(key=lambda f:(bool(f.get("is_primary")),f.get("uploaded_timestamp",0)),reverse=True)
    return fs[0] if fs else None

def download(url,dst):
    tmp=dst.with_suffix(dst.suffix+".part")
    urllib.request.urlretrieve(url,tmp); tmp.replace(dst)

def safe_name(s):
    return re.sub(r'[\\/:*?"<>|]+','_',s).strip()[:120] or 'mod'

def merge_tree(src,dst):
    dst.mkdir(parents=True,exist_ok=True)
    for p in src.iterdir():
        q=dst/p.name
        if p.is_dir(): merge_tree(p,q)
        else:
            q.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(p,q)

def install_archive(src,item,is_translation=False):
    if not zipfile.is_zipfile(src):
        dst=MODS/safe_name(item.get('name','mod')); dst.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst/src.name); return
    with tempfile.TemporaryDirectory(prefix='svru-') as td:
        tmp=pathlib.Path(td)
        with zipfile.ZipFile(src) as z:z.extractall(tmp)
        children=list(tmp.iterdir())
        # Normal mod archives commonly contain one or more ready-to-use mod folders.
        if not is_translation:
            if (tmp/'manifest.json').exists(): merge_tree(tmp,MODS/safe_name(item.get('name','mod')))
            else:
                for child in children:
                    if child.is_dir(): merge_tree(child,MODS/child.name)
                    else: shutil.copy2(child,MODS/child.name)
            return
        # Translation archives must overlay the installed original, not live in a separate Russian_Translations folder.
        target_id=item.get('for_mod_id')
        candidates=[]
        for d in MODS.iterdir():
            if not d.is_dir(): continue
            mf=d/'manifest.json'
            if mf.exists():
                try:
                    data=json.loads(mf.read_text(encoding='utf-8-sig'))
                    candidates.append((d,str(data.get('Name','')).lower()))
                except: pass
        hint=str(item.get('for_name') or item.get('name','')).lower().replace(' russian','')
        target=next((d for d,n in candidates if hint and (hint in n or n in hint)),None)
        # Most translation zips already reproduce the original folder layout; merge top-level folders by name first.
        merged=False
        for child in children:
            if child.is_dir() and (MODS/child.name).exists(): merge_tree(child,MODS/child.name); merged=True
        if not merged and target:
            if len(children)==1 and children[0].is_dir(): merge_tree(children[0],target)
            else: merge_tree(tmp,target)
        elif not merged:
            # Keep unresolved translation contents visible rather than silently discarding them.
            merge_tree(tmp,ROOT/'Translations_Unresolved'/safe_name(item.get('name','translation')))

def norm_id(item):
    raw=item.get("mod_id") or item.get("modId")
    return int(raw) if raw else None

def fetch_one(item,key,label,index,total,done,st):
    if item.get("external"):
        print(f"[{index}/{total}] {label}: внешняя позиция {item.get('name')} — автоматическая Nexus-загрузка невозможна")
        return
    mid=norm_id(item)
    if not mid: raise RuntimeError("нет Nexus mod ID")
    token=f"{label}:{mid}"
    if token in done:
        print(f"[{index}/{total}] {label} {mid}: уже обработан")
        return
    pack=api(f"https://api.nexusmods.com/v1/games/stardewvalley/mods/{mid}/files.json",key)
    f=choose_file(pack.get("files",[]),item)
    if not f: raise RuntimeError("подходящий файл не найден")
    fid=int(f["file_id"])
    links=api(f"https://api.nexusmods.com/v1/games/stardewvalley/mods/{mid}/files/{fid}/download_link.json",key)
    uri=next((x.get("URI") or x.get("uri") for x in links if x.get("URI") or x.get("uri")),None)
    if not uri: raise RuntimeError("нет download URI")
    name=f.get("file_name") or f"{mid}-{fid}.zip"; dst=RAW/name
    print(f"[{index}/{total}] {label}: скачиваю {name}")
    if not dst.exists(): download(uri,dst)
    install_archive(dst,item,is_translation=(label=='RU'))
    done.add(token); st["done"]=sorted(done); save_state(st)

def main():
    print("Stardew RU Mega Modpack — PC/Steam Deck build downloader (phone is storage only)")
    key=os.environ.get("NEXUS_API_KEY") or input("Вставьте Personal API Key Nexus (локально на телефоне): ").strip()
    u=validate(key)
    if not u.get("is_premium"): raise SystemExit("Nexus Premium не подтверждён.")
    print("Nexus Premium подтверждён.")
    manifest=pathlib.Path(__file__).with_name("queue.json")
    if not manifest.exists(): raise SystemExit("queue.json не найден рядом с loader.py")
    q=json.loads(manifest.read_text(encoding="utf-8"))
    mods=q.get("mods",[]); translations=q.get("translations",[]); held=q.get("held_for_review",[])
    st=load_state(); done=set(str(x) for x in st.get("done",[])); st["failed"]=[]
    jobs=[("MOD",x) for x in mods]+[("RU",x) for x in translations]
    total=len(jobs); downloadable=sum(1 for _,x in jobs if not x.get("external"))
    print(f"Очередь: {downloadable} Nexus-файлов; внешних: {total-downloadable}; на проверке: {len(held)}")
    for i,(label,item) in enumerate(jobs,1):
        try: fetch_one(item,key,label,i,total,done,st)
        except Exception as e:
            mid=item.get("mod_id") or item.get("modId")
            print(f"  ОШИБКА {item.get('name')} ({mid}): {e}")
            st.setdefault("failed",[]).append({"type":label,"modId":mid,"name":item.get("name"),"error":str(e)}); save_state(st)
    report={"mods":len(mods),"translations":len(translations),"held":held,"failed":st.get('failed',[])}
    (ROOT/'BUILD_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    out=ROOT/"Stardew_RU_Mega_Modpack.zip"
    print("Создаю итоговый ZIP...")
    if out.exists(): out.unlink()
    with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
        for p in MODS.rglob("*"):
            if p.is_file(): z.write(p,p.relative_to(ROOT))
        z.write(ROOT/'BUILD_REPORT.json','BUILD_REPORT.json')
        unresolved=ROOT/'Translations_Unresolved'
        if unresolved.exists():
            for p in unresolved.rglob('*'):
                if p.is_file(): z.write(p,p.relative_to(ROOT))
    print("ГОТОВО:",out)
    if held or st.get('failed'): print("ВНИМАНИЕ: BUILD_REPORT.json содержит позиции, требующие проверки/повтора.")
if __name__=="__main__": main()
