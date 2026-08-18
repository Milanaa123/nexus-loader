module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ok:false,error:"POST required"});
  const key = process.env.NEXUS_API_KEY;
  if (!key) return res.status(500).json({ok:false,error:"NEXUS_API_KEY is not configured"});
  const body = req.body || {};
  const headers = { apikey:key, "User-Agent":"nexus-loader/1.4" };
  try {
    if (body.action === "validate") {
      const r = await fetch("https://api.nexusmods.com/v1/users/validate.json",{headers});
      if (!r.ok) return res.status(r.status).json({ok:false,error:"Nexus validation failed"});
      return res.status(200).json({ok:true,data:{valid:true}});
    }
    if (body.action === "files") {
      const game = String(body.game || "stardewvalley").replace(/[^a-z0-9_-]/gi,"");
      const modId = Number(body.modId);
      if (!Number.isInteger(modId) || modId <= 0) return res.status(400).json({ok:false,error:"Invalid modId"});
      const r = await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`,{headers});
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ok:false,error:"Nexus files request failed"});
      return res.status(200).json({ok:true,data});
    }
    return res.status(400).json({ok:false,error:"Unknown action"});
  } catch(e) { return res.status(500).json({ok:false,error:"Request failed"}); }
}