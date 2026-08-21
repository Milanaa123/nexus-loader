module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["POST","GET"].includes(req.method)) return res.status(405).json({ok:false,error:"GET/POST required"});
  const key = process.env.NEXUS_API_KEY;
  if (!key) return res.status(500).json({ok:false,error:"NEXUS_API_KEY is not configured"});
  const body=req.method==="GET"?(req.query||{}):(req.body||{});
  const game=String(body.game||"stardewvalley").replace(/[^a-z0-9_-]/gi,"");
  const headers={apikey:key,"User-Agent":"nexus-loader/2.0"};
  const json=async url=>{const r=await fetch(url,{headers});let data=null;try{data=await r.json()}catch{}if(!r.ok){const e=new Error("Nexus request failed");e.status=r.status;e.data=data;throw e}return data};
  const positiveInt=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
  const chooseMain=(files,platform="desktop")=>{
    const all=Array.isArray(files)?files:[];
    const isAndroid=f=>/android/i.test(`${f.name||""} ${f.file_name||""} ${f.description||""}`);
    const candidates=all.filter(f=>f.category_name==="MAIN" || f.category_id===1);
    const platformOk=platform==="android"?candidates.filter(isAndroid):candidates.filter(f=>!isAndroid(f));
    return platformOk.find(f=>f.is_primary) || platformOk.sort((a,b)=>(b.uploaded_timestamp||0)-(a.uploaded_timestamp||0))[0] || candidates.find(f=>f.is_primary) || candidates[0] || null;
  };
  const nexusMirror=async(modId,fileId)=>{
    const user=await json("https://api.nexusmods.com/v1/users/validate.json");
    if(!user||!user.is_premium){const e=new Error("Nexus Premium required");e.status=403;throw e}
    const links=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fileId}/download_link.json`);
    const first=Array.isArray(links)?links.find(x=>x&&(x.URI||x.uri)):null;
    const uri=first&&(first.URI||first.uri);
    if(!uri){const e=new Error("Nexus returned no downloadable mirror");e.status=502;throw e}
    return uri;
  };
  const resolveIds=async(ids,platform="desktop")=>{
    const out=[];
    for(const modId of ids){
      try{
        const [meta,pack]=await Promise.all([
          json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}.json`),
          json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`)
        ]);
        const file=chooseMain(pack.files,platform);
        if(!file){out.push({modId,ok:false,error:"No MAIN file"});continue;}
        out.push({modId,ok:true,name:meta.name,modVersion:meta.version,fileId:file.file_id,fileName:file.file_name,fileVersion:file.version||file.mod_version||null,sizeBytes:file.size_in_bytes||null,uploaded:file.uploaded_timestamp||null,downloadPath:`/api/nexus?action=download&modId=${modId}&fileId=${file.file_id}&game=${game}`});
      }catch(e){out.push({modId,ok:false,status:e.status||500});}
    }
    return out;
  };
  try {
    if(body.action==="validate"){
      const data=await json("https://api.nexusmods.com/v1/users/validate.json");
      return res.json({ok:true,data:{valid:true,isPremium:Boolean(data&&data.is_premium)}});
    }
    if(body.action==="files"){
      const modId=positiveInt(body.modId);if(!modId)return res.status(400).json({ok:false,error:"Invalid modId"});
      return res.json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`)});
    }
    if(req.method==="GET"&&body.action==="resolveQueueCsv"){
      const ids=[...new Set(String(body.ids||"").split(",").map(Number).filter(x=>Number.isInteger(x)&&x>0))];
      if(!ids.length||ids.length>20)return res.status(400).json({ok:false,error:"Provide 1-20 comma-separated ids"});
      const platform=body.platform==="android"?"android":"desktop";
      return res.json({ok:true,data:{platform,items:await resolveIds(ids,platform)}});
    }
    if(req.method==="GET"&&body.action==="download"){
      const modId=positiveInt(body.modId),fileId=positiveInt(body.fileId);
      if(!modId||!fileId)return res.status(400).json({ok:false,error:"Invalid modId/fileId"});
      const uri=await nexusMirror(modId,fileId);
      res.setHeader("Location",uri); return res.status(302).end();
    }
    if(req.method==="GET"&&body.action==="proxyDownload"){
      const modId=positiveInt(body.modId),fileId=positiveInt(body.fileId);
      if(!modId||!fileId)return res.status(400).json({ok:false,error:"Invalid modId/fileId"});
      const uri=await nexusMirror(modId,fileId);
      const r=await fetch(uri,{redirect:"follow"});
      if(!r.ok)return res.status(502).json({ok:false,error:"Mirror download failed",status:r.status});
      const announced=Number(r.headers.get("content-length")||0);
      if(announced>3500000)return res.status(413).json({ok:false,error:"File too large for proxyDownload",sizeBytes:announced});
      const buf=Buffer.from(await r.arrayBuffer());
      if(buf.length>3500000)return res.status(413).json({ok:false,error:"File too large for proxyDownload",sizeBytes:buf.length});
      res.setHeader("Content-Type",r.headers.get("content-type")||"application/octet-stream");
      res.setHeader("Content-Length",String(buf.length));
      res.setHeader("Content-Disposition",`attachment; filename=\"nexus-${modId}-${fileId}\"`);
      return res.status(200).send(buf);
    }
    if(req.method==="GET") return res.status(400).json({ok:false,error:"Unsupported GET action"});
    if(body.action==="resolveQueue"){
      const ids=Array.isArray(body.modIds)?[...new Set(body.modIds.map(Number).filter(x=>Number.isInteger(x)&&x>0))]:[];
      if(!ids.length||ids.length>20)return res.status(400).json({ok:false,error:"Provide 1-20 modIds"});
      const platform=body.platform==="android"?"android":"desktop";
      const user=await json("https://api.nexusmods.com/v1/users/validate.json");
      if(!user||!user.is_premium)return res.status(403).json({ok:false,error:"Nexus Premium required"});
      return res.json({ok:true,data:{platform,items:await resolveIds(ids,platform)}});
    }
    if(body.action==="mod"||body.action==="batchMods"||body.action==="downloadLinks"){
      if(body.action==="mod"){
        const id=positiveInt(body.modId);if(!id)return res.status(400).json({ok:false,error:"Invalid modId"});
        return res.json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}.json`)});
      }
      if(body.action==="batchMods"){
        const ids=Array.isArray(body.modIds)?[...new Set(body.modIds.map(Number).filter(x=>Number.isInteger(x)&&x>0))]:[];
        if(!ids.length||ids.length>20)return res.status(400).json({ok:false,error:"Provide 1-20 modIds"});
        const out=[];for(const modId of ids){try{const meta=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}.json`);const files=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`);out.push({modId,ok:true,name:meta.name,version:meta.version,updated:meta.updated_timestamp,files:files.files||[]})}catch(e){out.push({modId,ok:false,status:e.status||500})}}return res.json({ok:true,data:out});
      }
      const modId=positiveInt(body.modId),fileId=positiveInt(body.fileId);if(!modId||!fileId)return res.status(400).json({ok:false,error:"Invalid modId/fileId"});
      const links=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fileId}/download_link.json`);
      return res.json({ok:true,data:{available:Array.isArray(links)&&links.length>0,mirrorCount:Array.isArray(links)?links.length:0}});
    }
    return res.status(400).json({ok:false,error:"Unknown action"});
  }catch(e){return res.status(e.status||500).json({ok:false,error:e.message||"Nexus request failed",status:e.status||500})}
};
