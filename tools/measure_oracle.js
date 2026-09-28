const E=require('../lib/jyotish-ephem.js'), O=require('../tests/vectors/oracle.json');
const d=(a,b)=>{let x=((a-b)%360+540)%360-180;return x*3600;};
const worst={};
function upd(k,v){v=Math.abs(v);worst[k]=Math.max(worst[k]||0,v);}
for(const r of O.positions){
  for(const b of ["Sun","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune"]){
    const p=E.planetApparent(b,r.jde); upd(b+" lon",d(p.lon,r[b][0])); upd(b+" lat",(p.lat-r[b][1])*3600);
    upd(b+" sid",d(E.sidereal(p.lon,r.jde),r[b][2]));
  }
  const m=E.moonApparent(r.jde); upd("Moon lon",d(m.lon,r.Moon[0])); upd("Moon lat",(m.lat-r.Moon[1])*3600); upd("Moon sid",d(E.sidereal(m.lon,r.jde),r.Moon[2]));
  upd("meanNode",d(E.nodeLon(r.jde,"mean")-E.nutation(r.jde).dpsi,r.meanNode)); upd("trueNode",d(E.nodeLon(r.jde,"true")-E.nutation(r.jde).dpsi,r.trueNode));
  const n=E.nutation(r.jde); upd("dpsi",(n.dpsi-r.dpsi)*3600); upd("eps",(n.eps-r.eps)*3600);
}
for(const q of O.rise){
  const rs=E.riseSet("Sun",q.jd0,q.lat,q.lon,"upper-limb-refracted"); upd("sunrise s",(rs.rise-q.sunrise)*86400); upd("sunset s",(rs.set-q.sunset)*86400);
  const mr=E.crossings("Moon",q.jd0,q.jd0+1.2,q.lat,q.lon).find(c=>c.kind==="rise"); if(mr) upd("moonrise s",(mr.jd-q.moonrise)*86400);
}
for(const a of O.asc){ const x=E.ascendant(a.jd,a.lat,a.lon); upd("asc sid",d(E.sidereal(x.asc,E.jde(a.jd)),a.ascSid)); }
for(const k in worst) console.log(k.padEnd(14), worst[k].toFixed(k.endsWith(" s")?1:2));
