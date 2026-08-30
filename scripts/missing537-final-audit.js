const AdmZip=require('adm-zip');
const SOURCES=[
 ['hxw','http://127.0.0.1:PORT/api/missingNexus?which=hxw'],
 ['anything','https://github.com/Sparky56p/AnythingAnywhere/releases/download/1.8.2-unofficial.7-Sparky56p/AnythingAnywhere.1.8.2-unofficial.7-Sparky56p.zip'],
 ['reset','https://github.com/Lake1059/ResetTerrainFeatures_NET6/releases/download/1.0.3-unofficial.3-Lake1059/SDV_1.6.10_RTF-1.0.3-unofficial.3-Lake1059.zip'],
 ['three','https://forums.stardewvalley.net/attachments/threeheartdancepartner-1-1-2-unofficial-2-flyingtnt-zip.20678/'],
 ['weather','https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip']
];
const wanted={
 hxw:{'i18n/default.json':'HXW_DEFAULT'},
 anything:{'i18n/default.json':'ANY_DEFAULT'},
 reset:{'i18n/default.json':'RESET_DEFAULT','i18n/ru.json':'RESET_RU'},
 three:{'i18n/default.json':'THREE_DEFAULT'},
 weather:{'[cs] weather wonders/i18n/default.json':'WEATHER_CS_DEFAULT','[cs] weather wonders/i18n/ru.json':'WEATHER_CS_RU','[dll] weather wonders/i18n/default.json':'WEATHER_DLL_DEFAULT','[dll] weather wonders/i18n/ru.json':'WEATHER_DLL_RU'}
};
async function get(raw,port){const u=raw.replace('PORT',String(port));const r=await fetch(u,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 nexus-loader/3.0'},signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('HTTP '+r.status+' '+u);return Buffer.from(await r.arrayBuffer())}
function emit(label,s){const b=Buffer.from(s,'utf8').toString('base64'),N=5000,n=Math.ceil(b.length/N);console.log(`M537SPEC_META|${label}|${Buffer.byteLength(s)}|${n}`);for(let i=0;i<n;i++)console.log(`M537SPEC_CHUNK|${label}|${String(i+1).padStart(3,'0')}|${b.slice(i*N,(i+1)*N)}`)}
setTimeout(async()=>{try{const port=process.env.PORT||10000;for(const [tag,u] of SOURCES){const b=await get(u,port),z=new AdmZip(b);for(const e of z.getEntries()){if(e.isDirectory)continue;let rel=e.entryName.replace(/^[^/]+\//,'').toLowerCase();if(tag==='weather')rel=e.entryName.replace(/^weather wonders - beta\//i,'').toLowerCase();const label=wanted[tag]?.[rel];if(label)emit(label,e.getData().toString('utf8'))}}console.log('M537SPEC_DONE')}catch(e){console.error('M537SPEC_ERR '+(e&&e.stack||e))}},15000);
