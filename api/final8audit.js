const {chooseFile}=require('../scripts/nexus-downloader');
const {findTranslation}=require('../scripts/find-translation');

const MODS=[
 {n:168,name:'Dynamic Shane and Sterling',author:'Cr00kshanks',modId:10675},
 {n:300,name:'Maggs Townsfolk Daily Dialogue Expansion',author:'MaggPlays',modId:31537},
 {n:312,name:"Miihau's Events- Gender Neutrality Tokens Patches",author:'WitchWeed',modId:27161},
 {n:358,name:'Nora The Herpetologist - Custom NPC for East Scarp',author:'bagibagriela',modId:18176},
 {n:498,name:'Trinkets To Treasures (Simplified)',author:'Bennoloth',modId:19091},
 {n:502,name:'Ultimate Guide To Clowning',author:'PossiblyClown',modId:37926},
 {n:505,name:'Unique Winter Star - Ridgeside Village',author:'AgentLyoko',modId:30294},
 {n:530,name:"farmerjack's Dialogue Expansions",author:'farmerjack',modId:9972}
];

module.exports=async(req,res)=>{
 try{
  const results=await Promise.all(MODS.map(async m=>{
   let file=null,fileError=null,translation=null,translationError=null;
   try{const f=await chooseFile('stardewvalley',m.modId);file={fileId:Number(f.file_id),name:f.name||null,fileName:f.file_name||null,version:f.version||f.mod_version||null,category:f.category_name||null,uploaded:f.uploaded_time||f.uploaded_timestamp||null,isPrimary:Boolean(f.is_primary)};}catch(e){fileError=e.message;}
   try{translation=await findTranslation({game:'stardewvalley',modName:m.name,author:m.author,modId:m.modId});}catch(e){translationError=e.message;}
   return {...m,file,fileError,translation,translationError};
  }));
  return res.json({ok:true,count:results.length,results});
 }catch(e){return res.status(500).json({ok:false,error:String(e.message||e)});}
};
