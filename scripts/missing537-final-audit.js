setTimeout(async()=>{
  const AdmZip=require('adm-zip');
  const {findTranslation}=require('./find-translation');
  const {downloadMod}=require('./nexus-downloader');
  const crypto=require('crypto');
  const items=[
    ['48918','Trolley Expansion'],['42138','RSV Interiors Reimagined'],['22714','Date Night Redux'],['6893','Community Center Helper'],['7286','Ridgeside Village'],['39812','The Arcanian Exchange'],['29049','Remapping'],['13883','Eli and Dylan - Custom NPCs for East Scarp'],['17775','Part of a Saloon Breakfast'],['22591',"Adventurer's Guild Expanded for 1.6"],['8505','Event Lookup'],['10384','Convenient Inventory'],['14709','Unique Winter Star'],['6304','Destroyable Bushes'],['23342','More Warp Points V2'],['21501','Unique Gift Dialogues Expanded'],['33245','Sophia Dialogue Expansion'],['30959',"Haywrite's Dialogue"],['29268','Haley Ever After - Sweet Edition'],['13437',"Rodney O'Brien"],['9246','Alternative Textures'],['541','Lookup Anything'],['10671','Alecto the Witch'],['10950','Jorts and Jean'],['239','NPC Map Locations'],['23979','Law and Order SV']
  ];
  try{
    const bundle=new AdmZip(); const report=[];
    for(const [modId,modName] of items){
      try{
        const tr=await findTranslation({game:'stardewvalley',modName,author:'',modId});
        if(!tr){report.push({modId,modName,status:'none'});console.log(`BULKRU_FIND|${modId}|none|${modName}`);continue;}
        const dl=await downloadMod({game:'stardewvalley',modId:tr.translationId});
        const b=require('fs').readFileSync(dl.path);
        const safe=`${modId}__${tr.translationId}__${String(tr.translationName).replace(/[^a-z0-9а-яё._ -]+/gi,'_').slice(0,80)}.zip`;
        bundle.addFile(safe,b);
        report.push({modId,modName,status:'ok',translationId:tr.translationId,translationName:tr.translationName,fileName:dl.fileName,size:b.length});
        console.log(`BULKRU_FIND|${modId}|${tr.translationId}|${b.length}|${tr.translationName}`);
      }catch(e){report.push({modId,modName,status:'error',error:e.message});console.log(`BULKRU_FIND|${modId}|error|${String(e.message).slice(0,180)}`);}
    }
    bundle.addFile('report.json',Buffer.from(JSON.stringify(report,null,2),'utf8'));
    const b=bundle.toBuffer(); const s=b.toString('base64'),N=6000,count=Math.ceil(s.length/N);
    console.log(`BULKRU_META|bytes=${b.length}|sha256=${crypto.createHash('sha256').update(b).digest('hex')}|chunks=${count}`);
    for(let i=0;i<count;i++)console.log(`BULKRU_CHUNK|${String(i+1).padStart(5,'0')}|${s.slice(i*N,(i+1)*N)}`);
    console.log('BULKRU_DONE');
  }catch(e){console.error('BULKRU_FATAL '+String(e&&e.stack||e));}
},12000);
