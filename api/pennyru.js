const AdmZip=require('adm-zip');

function maskTokens(s){
  const toks=[];
  const patterns=[/%item[\s\S]*?%%/g,/\{\{[\s\S]*?\}\}/g,/#\$[A-Za-z0-9_]+#/g,/\$[A-Za-z0-9_]+/g,/\[#\]/g,/\([A-Z]\)\d+/g,/@[A-Za-z0-9_.-]*/g];
  for(const re of patterns){s=s.replace(re,m=>{const k=`ZXQTK${String(toks.length).padStart(4,'0')}QXZ`;toks.push(m);return k;});}
  return [s,toks];
}
function unmask(s,toks){return s.replace(/ZXQTK(\d{4})QXZ/g,(_,n)=>toks[Number(n)]??_);}
async function tr(text){
  if(typeof text!=='string'||!/[A-Za-z]/.test(text))return text;
  const [masked,toks]=maskTokens(text);
  const u=new URL('https://translate.googleapis.com/translate_a/single');
  u.searchParams.set('client','gtx');u.searchParams.set('sl','en');u.searchParams.set('tl','ru');u.searchParams.set('dt','t');u.searchParams.set('q',masked);
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}}); if(!r.ok)throw new Error(`translate ${r.status}`);
  const j=await r.json(); const out=(j[0]||[]).map(x=>x&&x[0]||'').join(''); return unmask(out,toks);
}
async function mapLimit(entries,limit,fn){const out={};let i=0;async function worker(){while(true){const n=i++;if(n>=entries.length)return;const [k,v]=entries[n];out[k]=await fn(v);}}await Promise.all(Array.from({length:limit},worker));return out;}
module.exports=async function(req,res){
 try{
  const key=process.env.NEXUS_API_KEY;if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY missing'});
  const headers={APIKEY:key,'User-Agent':'nexus-loader/2.7','Application-Name':'nexus-loader','Application-Version':'2.7'};
  const game='stardewvalley',modId='45690';
  const fr=await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`,{headers});if(!fr.ok)throw new Error(`files ${fr.status}`);
  const fd=await fr.json();const files=(Array.isArray(fd)?fd:(fd.files||[])).filter(f=>f&&f.file_id&&!['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase())).sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
  const chosen=files.find(f=>/penny expansion/i.test(String(f.name||'')))||files[0];if(!chosen)throw new Error('no Penny file');
  const lr=await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${chosen.file_id}/download_link.json`,{headers});if(!lr.ok)throw new Error(`link ${lr.status}`);const links=await lr.json();const url=links[0]?.URI||links[0]?.uri;if(!url)throw new Error('no url');
  const zr=await fetch(url);const bytes=Buffer.from(await zr.arrayBuffer());const zip=new AdmZip(bytes);const ent=zip.getEntries().find(e=>/Penny Expansion\/i18n\/default\.json$/i.test(e.entryName)||/i18n\/default\.json$/i.test(e.entryName));if(!ent)throw new Error('default.json not found');
  const def=JSON.parse(ent.getData().toString('utf8').replace(/^\uFEFF/,''));const ru=await mapLimit(Object.entries(def),12,tr);
  const body=JSON.stringify(ru,null,2);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="penny_ru.json"');res.setHeader('X-Penny-Keys',String(Object.keys(ru).length));return res.send(body);
 }catch(e){return res.status(502).json({ok:false,error:e.message});}
};