function clean(value){
  return String(value || '').replace(/\s+/g,' ').trim();
}

function parseLine(line){
  const value=clean(line);
  if(!value) return null;

  if(value.includes(',')){
    const parts=value.split(',').map(clean);
    return {name:parts[0] || '', author:parts[1] || ''};
  }

  const parts=value.split(' ');
  return {
    name:parts.slice(0,-1).join(' '),
    author:parts[parts.length-1] || ''
  };
}

function parseInput(text){
  const seen=new Set();
  const result=[];

  for(const line of String(text || '').split(/\r?\n/)){
    const item=parseLine(line);
    if(!item || !item.name) continue;
    const key=(item.name+'|'+item.author).toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

module.exports={parseInput};
