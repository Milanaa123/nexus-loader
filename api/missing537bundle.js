const AdmZip=require('adm-zip');
const SOURCES=[
 ['Coiis_Hair_Sets_Pack.zip','/api/missingNexus?which=coii'],
 ['HxW_Bakery_and_Cafe_Furniture.zip','/api/missingNexus?which=hxw'],
 ['Anything_Anywhere.zip','https://github.com/Sparky56p/AnythingAnywhere/releases/download/1.8.2-unofficial.7-Sparky56p/AnythingAnywhere.1.8.2-unofficial.7-Sparky56p.zip'],
 ['Reset_Terrain_Features.zip','https://github.com/Lake1059/ResetTerrainFeatures_NET6/releases/download/1.0.3-unofficial.3-Lake1059/SDV_1.6.10_RTF-1.0.3-unofficial.3-Lake1059.zip'],
 ['Non_Destructive_NPCs.zip','https://forums.stardewvalley.net/attachments/nondestructivenpcs-1-6-0-zip.20119/'],
 ['ThreeHeartDancePartner.zip','https://forums.stardewvalley.net/attachments/threeheartdancepartner-1-1-2-unofficial-2-flyingtnt-zip.20678/'],
 ['Weather_Wonders_Beta.zip','https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip']
];
module.exports=async function(req,res){
 try{
  const port=process.env.PORT||10000, base=`http://127.0.0.1:${port}`;
  const out=new AdmZip(); const report=[];
  for(const [name,raw] of SOURCES){
   const url=raw.startsWith('/')?base+raw:raw;
   const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 nexus-loader/2.8'},signal:AbortSignal.timeout(300000)});
   if(!r.ok)throw new Error(`${name} HTTP ${r.status}`);
   const b=Buffer.from(await r.arrayBuffer());
   const sig=b.subarray(0,4).toString('hex');
   if(!['504b0304','504b0506','504b0708'].includes(sig))throw new Error(`${name} bad zip ${sig}`);
   new AdmZip(b).getEntries();
   out.addFile(name,b); report.push({name,bytes:b.length});
  }
  out.addFile('REPORT.json',Buffer.from(JSON.stringify({ok:true,files:report},null,2),'utf8'));
  const b=out.toBuffer();
  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition','attachment; filename="missing-537-sources.zip"');
  res.setHeader('Content-Length',String(b.length));
  return res.send(b);
 }catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)});}
};
