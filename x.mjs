import fs from 'fs';
const h=fs.readFileSync('at_ua.html','utf8');
const m=[...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
console.log('JSON-LD blocks:',m.length);
for(const b of m){ try{ const j=JSON.parse(b[1]);
  const t=Array.isArray(j)?j.map(x=>x['@type']):j['@type'];
  console.log(' @type:',JSON.stringify(t).slice(0,120));
  if(String(t).match(/Car|Vehicle|Product|Offer/)) console.log('  ',JSON.stringify(j).slice(0,700));
}catch(e){console.log(' parse fail');} }
// seller phone in payload
for(const k of ['telefoon','phone','Telefoon','verkoper','dealer']){
  const r=new RegExp(`.{40}${k}.{90}`,'g'); const f=[...h.matchAll(r)].slice(0,2);
  if(f.length) console.log(`\n--${k}--`), f.forEach(x=>console.log('  ',x[0].replace(/\s+/g,' ')));
}
