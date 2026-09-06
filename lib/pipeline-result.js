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

  const map={
    no_translation:'translation_missing',
    downloaded:'translation_downloaded',
    original_downloaded:'original_downloaded',
    built:'built',
    needs_review:'needs_review',
    error:'error'
  };

  return setStatus(state,map[item.status]||'translation_found');
}

module.exports={fromImport,fromTranslation};
