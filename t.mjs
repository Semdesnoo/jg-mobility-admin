const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const urls=[
 ['marktplaats','https://www.marktplaats.nl/v/auto-s/bestelauto-s/a1528612245-opel-vivaro-1-6cdti-bestelbus-2018-l1-h1-diesel'],
 ['autoscout24','https://www.autoscout24.nl/aanbod/volvo-v40-1-5-t3-dynamic-edition-keyless-autopark-camera-nap-benzine-zwart-cat_ma73mo2082-257825c2-9a43-41aa-90ac-bab8dc9dc244'],
 ['autotrack','https://www.autotrack.nl/a/volvo-v90-benzine-2018-59784163'],
 ['gaspedaal','https://www.gaspedaal.nl/volvo/v90'],
];
for (const [n,u] of urls){
  for (const [label,h] of [['no-headers',{}],['browser-UA',{'User-Agent':UA,'Accept-Language':'nl-NL,nl;q=0.9'}]]){
    const t=Date.now();
    try{
      const r=await fetch(u,{headers:h,redirect:'follow'});
      const b=await r.text();
      console.log(`${n.padEnd(12)} ${label.padEnd(11)} status=${r.status} bytes=${b.length} ms=${Date.now()-t} server=${r.headers.get('server')||'-'}`);
    }catch(e){ console.log(`${n.padEnd(12)} ${label.padEnd(11)} ERROR ${e.message}`); }
  }
}
