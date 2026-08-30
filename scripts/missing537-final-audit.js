const AdmZip=require('adm-zip');
const SOURCES=[
 ['coii','http://127.0.0.1:PORT/api/missingNexus?which=coii'],
 ['hxw','http://127.0.0.1:PORT/api/missingNexus?which=hxw'],
 ['anything','https://github.com/Sparky56p/AnythingAnywhere/releases/download/1.8.2-unofficial.7-Sparky56p/AnythingAnywhere.1.8.2-unofficial.7-Sparky56p.zip'],
 ['reset','https://github.com/Lake1059/ResetTerrainFeatures_NET6/releases/download/1.0.3-unofficial.3-Lake1059/SDV_1.6.10_RTF-1.0.3-unofficial.3-Lake1059.zip'],
 ['three','https://forums.stardewvalley.net/attachments/threeheartdancepartner-1-1-2-unofficial-2-flyingtnt-zip.20678/'],
 ['weather','https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip']
];
async function get(raw,port){const u=raw.replace('PORT',String(port));const r=await fetch(u,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 nexus-loader/2.9'},signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('HTTP '+r.status+' '+u);return Buffer.from(await r.arrayBuffer())}
function wanted(tag,p){const x=p.toLowerCase();if(!/\.(json|jsonc|txt)$/i.test(p))return false;if(tag==='weather')return /(i18n|translation|manifest)/.test(x);if(tag==='reset'||tag==='anything'||tag==='three')return /(i18n|manifest)/.test(x);if(tag==='coii')return /(content|manifest|read me|i18n)/.test(x);if(tag==='hxw')return /(content|manifest|data|i18n)/.test(x);return false}
function emit(tag,p,s){const b=Buffer.from(s,'utf8').toString('base64'),N=5000,n=Math.ceil(b.length/N);console.log(`M537TXT2_META|${tag}|${Buffer.byteLength(s)}|${n}|${p}`);for(let i=0;i<n;i++)console.log(`M537TXT2_CHUNK|${tag}|${String(i+1).padStart(3,'0')}|${b.slice(i*N,(i+1)*N)}`)}
setTimeout(async()=>{try{const port=process.env.PORT||10000;for(const [tag,u] of SOURCES){const b=await get(u,port),z=new AdmZip(b);if(tag==='coii'||tag==='hxw')console.log(`M537TXT2_LIST|${tag}|`+z.getEntries().filter(e=>!e.isDirectory).map(e=>e.entryName).join(' || '));for(const e of z.getEntries()){if(e.isDirectory||e.header.size>250000||!wanted(tag,e.entryName))continue;emit(tag,e.entryName,e.getData().toString('utf8'))}}console.log('M537TXT2_DONE')}catch(e){console.error('M537TXT2_ERR '+(e&&e.stack||e))}},15000);
