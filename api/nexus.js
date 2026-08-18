module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["POST","GET"].includes(req.method)) return res.status(405).json({ok:false,error:"GET/POST required"});
  const key = process.env.NEXUS_API_KEY;
  if (!key) return res.status(500).json({ok:false,error:"NEXUS_API_KEY is not configured"});
  const body=req.method==="GET"?(req.query||{}):(req.body||{});
  const game=String(body.game||"stardewvalley").replace(/[^a-z0-9_-]/gi,"");
  const headers={apikey:key,"User-Agent":"nexus-loader/1.6"};
  const json=async url=>{const r=await fetch(url,{headers});let data=null;try{data=await r.json()}catch{}if(!r.ok){const e=new Error("Nexus request failed");e.status=r.status;throw e}return data};
  try {
    if(body.action==="validate"){
      const data=await json("https://api.nexusmods.com/v1/users/validate.json");
      return res.json({ok:true,data:{valid:true,isPremium:Boolean(data && data.is_premium)}})
    }
    if(req.method==="GET") return res.status(400).json({ok:false,error:"GET only supports action=validate"});
    if(body.action==="mod"||body.action==="files"){
      const id=Number(body.modId);if(!Number.isInteger(id)||id<=0)return res.status(400).json({ok:false,error:"Invalid modId"});
      const suffix=body.action==="files"?"/files.json":".json";
      return res.json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}${suffix}`)});
    }
    if(body.action==="batchMods"){
      const ids=Array.isArray(body.modIds)?[...new Set(body.modIds.map(Number).filter(x=>Number.isInteger(x)&&x>0))]:[];
      if(!ids.length)return res.status(400).json({ok:false,error:"modIds required"});
      if(ids.length>20)return res.status(400).json({ok:false,error:"Maximum 20 mod IDs per request"});
      const out=[];
      for(const modId of ids){try{const meta=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}.json`);const files=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`);out.push({modId,ok:true,name:meta.name,version:meta.version,updated:meta.updated_timestamp,files:files.files||[]})}catch(e){out.push({modId,ok:false,status:e.status||500})}}
      return res.json({ok:true,data:out});
    }
    if(body.action==="downloadLinks"){
      const modId=Number(body.modId),fileId=Number(body.fileId);if(!Number.isInteger(modId)||modId<=0||!Number.isInteger(fileId)||fileId<=0)return res.status(400).json({ok:false,error:"Invalid modId/fileId"});
      let url=`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fileId}/download_link.json`;
      if(body.nxmKey&&body.expires)url+=`?key=${encodeURIComponent(body.nxmKey)}&expires=${encodeURIComponent(body.expires)}`;
      return res.json({ok:true,data:await json(url)});
    }
    return res.status(400).json({ok:false,error:"Unknown action"});
  }catch(e){return res.status(e.status||500).json({ok:false,error:"Nexus request failed",status:e.status||500})}
}