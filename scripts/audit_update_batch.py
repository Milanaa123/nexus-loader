import json, re, zipfile, pathlib
ROOT=pathlib.Path('audit')
OUT=ROOT/'out'; OUT.mkdir(parents=True, exist_ok=True)

def read_json_loose(text):
    text=text.lstrip('\ufeff')
    text=re.sub(r'(?m)^\s*//.*$', '', text)
    text=re.sub(r',\s*([}\]])', r'\1', text)
    return json.loads(text)

def zip_entries(name):
    p=ROOT/'zips'/name
    z=zipfile.ZipFile(p)
    rows=[]
    for i in z.infolist():
        if i.is_dir(): continue
        rows.append({'path':i.filename,'bytes':i.file_size})
    return z,rows

def text_files_report(zipname, outname):
    z,rows=zip_entries(zipname)
    ex=re.compile(r'\.(json|jsonc|txt|md|xml|tmx|yaml|yml|csv|ini|cfg|config|toml|properties)$', re.I)
    out={'archive':zipname,'entries':rows,'textFiles':[]}
    for r in rows:
        if not ex.search(r['path']) or r['bytes']>200000: continue
        try: t=z.read(r['path']).decode('utf-8-sig')
        except: continue
        out['textFiles'].append({'path':r['path'],'bytes':r['bytes'],'text':t[:200000]})
    (OUT/outname).write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    return out

def find_i18n(zipname, lang):
    z,_=zip_entries(zipname)
    cand=[]
    pat=re.compile(rf'(^|/)i18n/{re.escape(lang)}\.json$',re.I)
    for n in z.namelist():
        if pat.search(n):
            cand.append((n,z.read(n).decode('utf-8-sig')))
    return cand

def placeholders(s):
    pats=[r'\{\{[^{}]+\}\}',r'\{\d+[^{}]*\}',r'%item\b[^%]*%',r'\$[a-zA-Z0-9#]+',r'\[[^\]]+\]',r'@',r'\^+']
    out=[]
    for p in pats: out.extend(re.findall(p,s))
    return sorted(out)

def parity(source_obj, ru_obj):
    missing=[k for k in source_obj if k not in ru_obj]
    extra=[k for k in ru_obj if k not in source_obj]
    mismatch=[]
    for k in source_obj:
        if k in ru_obj and placeholders(str(source_obj[k]))!=placeholders(str(ru_obj[k])):
            mismatch.append({'key':k,'sourceTokens':placeholders(str(source_obj[k])),'ruTokens':placeholders(str(ru_obj[k]))})
    return {
        'sourceKeys':len(source_obj),'ruKeys':len(ru_obj),
        'missingCount':len(missing),'extraCount':len(extra),'tokenMismatchCount':len(mismatch),
        'missing':[{'key':k,'source':source_obj[k]} for k in missing],
        'extra':extra,'tokenMismatches':mismatch
    }

for zname,oname in [
    ('simple-weapons.zip','inspect-simple-weapons.json'),
    ('crop-growth-adjustments.zip','inspect-crop-growth-adjustments.json'),
    ('blinkfix.zip','inspect-blinkfix.json'),
    ('billboard-beautifier.zip','inspect-billboard-beautifier.json')]:
    text_files_report(zname,oname)

src=find_i18n('evelyn-expansion-1.5.zip','default')
ru=find_i18n('evelyn-expansion-ru-1.1.zip','ru')
ev={'sourceCandidates':[x[0] for x in src],'ruCandidates':[x[0] for x in ru]}
if src and ru:
    s=read_json_loose(src[0][1]); r=read_json_loose(ru[0][1]); ev.update(parity(s,r))
(OUT/'evelyn-ru-delta.json').write_text(json.dumps(ev,ensure_ascii=False,indent=2),encoding='utf-8')

awsrc=find_i18n('a-warm-welcome-1.3.1.zip','default')
aw={'sourceCandidates':[x[0] for x in awsrc]}
merged={}
for p in [
    pathlib.Path('data/review/a-warm-welcome-1.3.1-ru-part01.json'),
    pathlib.Path('data/review/a-warm-welcome-1.3.1-ru-part02-ridgeside.json'),
    pathlib.Path('data/review/a-warm-welcome-1.3.1-ru-part03-east-scarp.json')]:
    merged.update(json.loads(p.read_text(encoding='utf-8')))
if awsrc:
    s=read_json_loose(awsrc[0][1]); aw.update(parity(s,merged))
(OUT/'a-warm-welcome-parity.json').write_text(json.dumps(aw,ensure_ascii=False,indent=2),encoding='utf-8')

msrc=find_i18n('mastery-extended-2.2.2.zip','default')
mr={'sourceCandidates':[x[0] for x in msrc]}
ruobj=json.loads(pathlib.Path('data/review/mastery-extended-2.2.2-ru.json').read_text(encoding='utf-8'))
if msrc:
    s=read_json_loose(msrc[0][1]); mr.update(parity(s,ruobj))
(OUT/'mastery-extended-parity.json').write_text(json.dumps(mr,ensure_ascii=False,indent=2),encoding='utf-8')

summary={
    'evelyn':{k:ev.get(k) for k in ['sourceKeys','ruKeys','missingCount','extraCount','tokenMismatchCount']},
    'aWarmWelcome':{k:aw.get(k) for k in ['sourceKeys','ruKeys','missingCount','extraCount','tokenMismatchCount']},
    'masteryExtended':{k:mr.get(k) for k in ['sourceKeys','ruKeys','missingCount','extraCount','tokenMismatchCount']},
}
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
