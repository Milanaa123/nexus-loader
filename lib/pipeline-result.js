const {createModState, setStatus}=require('./mod-status');

function fromImport(item){
  const state=createModState({
    name:item.name,
    author:item.author,
    nexusModId:item.nexusModId||null
  });

  const map={
    found:'found',
    multiple_matches:'multiple_matches',
    not_found:'not_found',
    error:'error'
  };

  return setStatus(state,map[item.status]||'imported');
}

function fromTranslation(item){
  const state=createModState({
    name:item.name,
    author:item.author,
    nexusModId:item.modId||null,
    translationId:item.translationId||null
  });

  if(item.status==='no_translation') return setStatus(state,'translation_missing');
  if(item.status==='downloaded') return setStatus(state,'translation_downloaded');
  if(item.status==='error') return setStatus(state,'error');

  return state;
}

module.exports={fromImport,fromTranslation};
