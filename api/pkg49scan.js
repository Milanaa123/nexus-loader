const idResolver=require('./generateIds');
const {findTranslation}=require('../scripts/find-translation');
const MODS=[
 {n:147,name:'Cuter Slimes Refreshed',author:'JennaJuffuffles'},
 {n:148,name:"DaisyNiko's Tilesheets",author:'DaisyNiko'},
 {n:168,name:'Dynamic Shane and Sterling',author:'Cr00kshanks'},
 {n:234,name:"Haywrite's All-In-One Dialogue Expansion",author:'silvermoonchan'},
 {n:300,name:'Maggs Townsfolk Daily Dialogue Expansion',author:'MaggPlays'},
 {n:310,name:'Metalcore Goes Cottagecore - East Scarp Addon',author:'ottersqueaks'},
 {n:311,name:"Miihau's Abigail Event Expansion",author:'Miihau'},
 {n:312,name:"Miihau's Events- Gender Neutrality Tokens Patches",author:'WitchWeed'},
 {n:313,name:"Miihau's Haley Event Expansion",author:'Miihau'},
 {n:316,name:"Miihau's Shane Event Expansion",author:'Miihau'},
 {n:358,name:'Nora The Herpetologist - Custom NPC for East Scarp',author:'bagibagriela'},
 {n:498,name:'Trinkets To Treasures (Simplified)',author:'Bennoloth'},
 {n:502,name:'Ultimate Guide To Clowning',author:'PossiblyClown'},
 {n:505,name:'Unique Winter Star - Ridgeside Village',author:'AgentLyoko'},
 {n:530,name:"farmerjack's Dialogue Expansions",author:'farmerjack'}
];
module.exports=async function(req,res){
 try{
  const out=[];
  for(const m of MODS){
   let modId=null,tr=null,error=null;
   try{modId=await idResolver.searchMod(m);}catch(e){error='id:'+e.message;}
   if(modId){try{tr=await findTranslation({game:'stardewvalley',modName:m.name,author:m.author,modId});}catch(e){error=(error?error+' | ':'')+'tr:'+e.message;}}
   out.push({...m,modId,translation:tr,error});
  }
  return res.json({ok:true,count:out.length,rows:out});
 }catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)});}
};