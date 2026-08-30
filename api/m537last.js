module.exports=async function(req,res){
  const slug=String(req.query?.slug||'g3i395');
  const revision=Number(req.query?.revision||72);
  const query=`query CollectionRevisionMods($revision:Int,$slug:String!,$viewAdultContent:Boolean){collectionRevision(revision:$revision,slug:$slug,viewAdultContent:$viewAdultContent){externalResources{id name resourceType resourceUrl} modFiles{fileId optional file{name mod{modId name author game{domainName}}}}}}`;
  const body=JSON.stringify({query,variables:{slug,revision,viewAdultContent:true},operationName:'CollectionRevisionMods'});
  const endpoints=['https://api-router.nexusmods.com/graphql','https://api.nexusmods.com/v2/graphql'];
  let last='';
  for(const url of endpoints){
    try{
      const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','user-agent':'Mozilla/5.0 nexus-loader/3.2'},body,signal:AbortSignal.timeout(30000)});
      const text=await r.text(); last=`${url} ${r.status} ${text.slice(0,500)}`;
      if(!r.ok)continue;
      const j=JSON.parse(text); const cr=j?.data?.collectionRevision; if(!cr)continue;
      const ext=cr.externalResources||[];
      const hits=ext.filter(x=>/revised|ridgeside|bus\s*stop/i.test(`${x.name||''} ${x.resourceUrl||''}`));
      const mods=(cr.modFiles||[]).filter(x=>/revised|ridgeside|bus\s*stop/i.test(`${x.file?.name||''} ${x.file?.mod?.name||''}`)).map(x=>({fileId:x.fileId,optional:x.optional,fileName:x.file?.name,modId:x.file?.mod?.modId,modName:x.file?.mod?.name,author:x.file?.mod?.author}));
      return res.status(200).json({ok:true,slug,revision,externalCount:ext.length,hits,modHits:mods,allExternal:ext});
    }catch(e){last=`${url} ${e.message}`;}
  }
  return res.status(502).json({ok:false,error:last});
};
