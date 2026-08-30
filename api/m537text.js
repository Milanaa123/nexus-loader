const AdmZip=require('adm-zip');
const specs={
 HXW_DEFAULT:['http://127.0.0.1:PORT/api/missingNexus?which=hxw','[CP] H&W Bakery Furniture/i18n/default.json'],
 ANY_DEFAULT:['https://github.com/Sparky56p/AnythingAnywhere/releases/download/1.8.2-unofficial.7-Sparky56p/AnythingAnywhere.1.8.2-unofficial.7-Sparky56p.zip','AnythingAnywhere/i18n/default.json'],
 RESET_DEFAULT:['https://github.com/Lake1059/ResetTerrainFeatures_NET6/releases/download/1.0.3-unofficial.3-Lake1059/SDV_1.6.10_RTF-1.0.3-unofficial.3-Lake1059.zip','ResetTerrainFeatures_NET6/i18n/default.json'],
 RESET_RU:['https://github.com/Lake1059/ResetTerrainFeatures_NET6/releases/download/1.0.3-unofficial.3-Lake1059/SDV_1.6.10_RTF-1.0.3-unofficial.3-Lake1059.zip','ResetTerrainFeatures_NET6/i18n/ru.json'],
 THREE_DEFAULT:['https://forums.stardewvalley.net/attachments/threeheartdancepartner-1-1-2-unofficial-2-flyingtnt-zip.20678/','ThreeHeartDancePartner/i18n/default.json'],
 WEATHER_CS_DEFAULT:['https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip','Weather Wonders - Beta/[CS] Weather Wonders/i18n/default.json'],
 WEATHER_CS_RU:['https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip','Weather Wonders - Beta/[CS] Weather Wonders/i18n/ru.json'],
 WEATHER_DLL_DEFAULT:['https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip','Weather Wonders - Beta/[DLL] Weather Wonders/i18n/default.json'],
 WEATHER_DLL_RU:['https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip','Weather Wonders - Beta/[DLL] Weather Wonders/i18n/ru.json']
};
module.exports=async function(req,res){try{const key=String(req.query?.name||req.body?.name||'').toUpperCase();const spec=specs[key];if(!spec)return res.status(400).json({ok:false,error:'unknown name',available:Object.keys(specs)});let u=spec[0].replace('PORT',String(process.env.PORT||10000));const r=await fetch(u,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 nexus-loader/3.1'},signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());const z=new AdmZip(b);const e=z.getEntry(spec[1]);if(!e)throw Error('entry not found: '+spec[1]);const text=e.getData().toString('utf8');res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.status(200).send(text)}catch(e){return res.status(500).json({ok:false,error:e.message})}};
