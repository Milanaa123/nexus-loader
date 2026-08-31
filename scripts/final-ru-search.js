const {findTranslation}=require('./find-translation');
const items=[
['48918','Trolley Expansion'],['42138','RSV Interiors Reimagined'],['2544','Canon-Friendly Dialogue Expansion'],['22714','Date Night Redux'],['7286','Ridgeside Village'],['13883','Eli and Dylan'],['39812','The Arcanian Exchange'],['14709','Unique Winter Star'],['10770','Lurking in the Dark'],['10384','Convenient Inventory'],['29049','Remapping'],['22591',"Adventurer's Guild Expanded for 1.6"],['23342','More Warp Points V2'],['13437',"Rodney O'Brien"],['33245','Sophia Dialogue Expansion'],['17775','Part of a Saloon Breakfast'],['8505','Event Lookup'],['8684','Grapes of Ferngill'],['23979','Law and Order SV'],['21501','Unique Gift Dialogues Expanded']
];
setTimeout(async()=>{
 for(const [modId,modName] of items){
  try{const r=await findTranslation({game:'stardewvalley',modName,author:'',modId});console.log('RUFIND|'+modId+'|'+modName+'|'+JSON.stringify(r));}
  catch(e){console.log('RUFINDERR|'+modId+'|'+modName+'|'+e.message);}
 }
 console.log('RUFIND_DONE');
},10000);
