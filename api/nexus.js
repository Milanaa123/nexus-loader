module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ok:false,error:"POST required"});
  const key = process.env.NEXUS_API_KEY;
  if (!key) return res.status(500).json({ok:false,error:"NEXUS_API_KEY is not configured"});
  const body = req.body || {};
  const headers = { apikey:key, "User-Agent":"nexus-loader/1.5" };
  const game = String(body.game || "stardewvalley").replace(/[^a-z0-9_-]/gi,"");
  const json = async (url) => {
    const r = await fetch(url,{headers});
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) {
      const e = new Error("Nexus request failed");
      e.status = r.status;
      e.data = data;
      throw e;
    }
    return data;
  };
  try {
    if (body.action === "validate") {
      await json("https://api.nexusmods.com/v1/users/validate.json");
      return res.status(200).json({ok:true,data:{valid:true}});
    }
    if (body.action === "mod") {
      const modId = Number(body.modId);
      if (!Number.isInteger(modId) || modId <= 0) return res.status(400).json({ok:false,error:"Invalid modId"});
      return res.status(200).json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}.json`)});
    }
    if (body.action === "files") {
      const modId = Number(body.modId);
      if (!Number.isInteger(modId) || modId <= 0) return res.status(400).json({ok:false,error:"Invalid modId"});
      return res.status(200).json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`)});
    }
    if (body.action === "batchFiles") {
      const ids = Array.isArray(body.modIds) ? body.modIds.map(Number).filter(x=>Number.isInteger(x)&&x>0) : [];
      if (!ids.length) return res.status(400).json({ok:false,error:"modIds required"});
      if (ids.length > 20) return res.status(400).json({ok:false,error:"Maximum 20 mod IDs per request"});
      const out=[];
      for (const modId of ids) {
        try {
          const data=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`);
          out.push({modId,ok:true,data});
        } catch(e) { out.push({modId,ok:false,status:e.status||500}); }
      }
      return res.status(200).json({ok:true,data:out});
    }
    if (body.action === "downloadLinks") {
      const modId = Number(body.modId), fileId = Number(body.fileId);
      if (!Number.isInteger(modId)||modId<=0||!Number.isInteger(fileId)||fileId<=0) return res.status(400).json({ok:false,error:"Invalid modId/fileId"});
      let url=`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fileId}/download_link.json`;
      if (body.nxmKey && body.expires) url += `?key=${encodeURIComponent(body.nxmKey)}&expires=${encodeURIComponent(body.expires)}`;
      return res.status(200).json({ok:true,data:await json(url)});
    }
    return res.status(400).json({ok:false,error:"Unknown action"});
  } catch(e) {
    return res.status(e.status || 500).json({ok:false,error:"Nexus request failed",status:e.status || 500});
  }
}