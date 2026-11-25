/* 在 autoClean 内部插桩：定位 R5 在含亮刀场景下被哪一步删掉 */
const fs=require("fs");
const html=fs.readFileSync("magic-circle.html","utf8");
const s=html.indexOf("/* ==================== PURE START"), e=html.indexOf("/* ==================== PURE END");
let code=html.slice(s,e);
// 插桩
code=code.replace("  const mp=new Uint8Array(N);\n  for(let i=0;i<N;i++) mp[i]=(valid[i] && resp[i]>=lo)?1:0;",
`  globalThis.__lo=lo; globalThis.__p90=p90; globalThis.__vmax=vmax;
  const mp=new Uint8Array(N);
  for(let i=0;i<N;i++) mp[i]=(valid[i] && resp[i]>=lo)?1:0;`);
code=code.replace("  for(let c=0;c<comps.length;c++) if(!keep[c]) speckPx+=comps[c].area;\n  for(let i=0;i<N;i++) if(mp[i] && !keep[labels[i]]) mp[i]=0;",
`  for(let c=0;c<comps.length;c++) if(!keep[c]) speckPx+=comps[c].area;
  globalThis.__comps=comps.length; globalThis.__speck=speckPx;
  for(let i=0;i<N;i++) if(mp[i] && !keep[labels[i]]) mp[i]=0;`);
code=code.replace("  let structPx=0;\n  if(opt.struct){",
`  globalThis.__ap=ap; globalThis.__mp=mp; globalThis.__PW=PW; globalThis.__PH=PH;
  let structPx=0;
  if(opt.struct){`);
const mod={};
new Function("exports", code+
  "\nexports.autoClean=autoClean; exports.FLAT_ROI=FLAT_ROI; exports.polarLum=polarLum; exports.morph2D=morph2D; exports.buildBackground=buildBackground; exports.chamferDT=chamferDT; exports.dilate=dilate;")(mod);
const {autoClean,FLAT_ROI}=mod;

/* 合成（同 _dbg3，含亮刀） */
const S=1024, R=S*0.5/FLAT_ROI, cx=S/2, cy=S/2;
const rgba=new Uint8ClampedArray(S*S*4);
const rings=[
  {r:0.966,w:3.0,i:1.00,c:[0.78,0.96,1.00]},
  {r:0.928,w:1.6,i:0.50,c:[0.78,0.96,1.00]},
  {r:0.872,w:5.0,i:0.62,c:[1.00,0.86,0.55]},
  {r:0.640,w:2.0,i:0.85,c:[0.78,0.96,1.00]},
  {r:0.520,w:1.4,i:0.38,c:[0.78,0.96,1.00]},
  {r:0.300,w:2.4,i:0.75,c:[1.00,0.90,0.70]},
];
const bl={x:cx+0.30*R, y:cy+0.10*R, a:0.20*R, b:0.34*R, ang:0.35};
const ca0=Math.cos(bl.ang), sa0=Math.sin(bl.ang);
function rnd(i){ const v=Math.sin(i*12.9898+i*0.0007*78.233)*43758.5453; return v-Math.floor(v); }
for(let y=0;y<S;y++){
  for(let x=0;x<S;x++){
    const i=y*S+x, dx=x+0.5-cx, dy=y+0.5-cy;
    const rp=Math.hypot(dx,dy), rn=rp/R;
    const glow=Math.pow(Math.max(0,1-Math.min(1,rn)),2.2)*0.20;
    const vig=Math.max(0,1-rn*0.55);
    let r=0.030+glow*0.9+vig*0.012, g=0.028+glow*0.75+vig*0.010, b=0.055+glow*1.15+vig*0.014;
    const n=(rnd(i)-0.5)*0.012; r+=n; g+=n; b+=n;
    for(const rg of rings){
      const d=Math.abs(rn-rg.r)*R;
      if(d<=rg.w/2+1){
        const cov=Math.max(0,Math.min(1, 0.5+(rg.w/2-d)));
        r+=cov*rg.i*rg.c[0]; g+=cov*rg.i*rg.c[1]; b+=cov*rg.i*rg.c[2];
      }
    }
    let a=Math.atan2(dy,dx); if(a<0)a+=Math.PI*2;
    const sa=a/(Math.PI*2)*24, kk=Math.round(sa);
    const dAng=Math.abs(sa-kk)/24*Math.PI*2*rp;
    if(rp>0.17*R && rp<0.935*R && dAng<=2.25){
      const cov=Math.max(0,Math.min(1,0.5+(1.25-dAng)));
      r+=cov*0.55*0.72; g+=cov*0.55*0.90; b+=cov*0.55*1.0;
    }
    const bx=x+0.5-bl.x, by=y+0.5-bl.y;
    const u= ca0*bx+sa0*by, v=-sa0*bx+ca0*by;
    if((u*u)/(bl.a*bl.a)+(v*v)/(bl.b*bl.b)<=1){
      const shade=0.34+0.16*(-v/bl.b);
      r=0.62*shade+0.20; g=0.40*shade+0.12; b=0.34*shade+0.10;
    }
    const sdx=1.0*R, sdy=-0.75*R;
    const L2=sdx*sdx+sdy*sdy;
    let tt=((x+0.5-(cx-0.45*R))*sdx+(y+0.5-(cy+0.30*R))*sdy)/L2;
    if(tt>=0&&tt<=1){
      const px=cx-0.45*R+tt*sdx, py=cy+0.30*R+tt*sdy;
      const d=Math.hypot(x+0.5-px, y+0.5-py);
      if(d<=7.5){
        const cov=Math.max(0,Math.min(1,0.5+(6.5-d)));
        r=r*(1-cov)+cov*0.95; g=g*(1-cov)+cov*0.97; b=b*(1-cov)+cov*1.0;
      }
    }
    const o=i*4;
    rgba[o]=Math.min(255,Math.round(r*255));
    rgba[o+1]=Math.min(255,Math.round(g*255));
    rgba[o+2]=Math.min(255,Math.round(b*255));
    rgba[o+3]=255;
  }
}

const {polarLum,morph2D}=mod;
const PW0=Math.max(720, Math.min(2400, Math.round(Math.PI*2*R)));
const PH0=Math.max(256, Math.min(1100, Math.round(R*1.08)));
const pl=polarLum(rgba,S,PW0,PH0);
const L0=pl.L, vd=pl.valid;
const m0=Math.max(2, Math.min(36, Math.round(R*6/100)));
const op0=Float32Array.from(L0); morph2D(op0,PW0,PH0,m0,false); morph2D(op0,PW0,PH0,m0,true);
const rs0=new Float32Array(PW0*PH0); let vm0=0;
for(let i=0;i<PW0*PH0;i++){ rs0[i]=vd[i]?Math.max(0,L0[i]-op0[i]):0; if(rs0[i]>vm0)vm0=rs0[i]; }
console.log('vmax',vm0.toFixed(1));
// 按 radial 行统计 resp>59 的占比
for(let j0=0;j0<PH0;j0+=44){
  let hi=0, vv=0;
  for(let j=j0;j<Math.min(PH0,j0+44);j++)for(let i=0;i<PW0;i++){ const k=j*PW0+i; if(!vd[k])continue; vv++; if(rs0[k]>59)hi++; }
  const rn=((j0+22)/PH0)*FLAT_ROI;
  console.log('rn≈'+rn.toFixed(2), 'resp>59 占该行带', (hi/vv*100).toFixed(1)+'%');
}
const res=autoClean(rgba,S,{thr:44,strokePct:6,edge:45,blobs:true,dark:false,struct:false});
console.log("lo=",globalThis.__lo.toFixed(2),"p90bin=",globalThis.__p90,"vmax=",globalThis.__vmax.toFixed(1),
  "连通域=",globalThis.__comps,"被去碎点=",globalThis.__speck);
const PW=globalThis.__PW, PH=globalThis.__PH, mp=globalThis.__mp, ap=globalThis.__ap;
const ci=Math.floor(2.0/(Math.PI*2)*PW);
for(let rn=0.514; rn<=0.526; rn+=0.002){
  const j=Math.round(rn/FLAT_ROI*PH-0.5);
  const i=j*PW+ci;
  console.log("极坐标 R5@2.0 rn="+rn.toFixed(3), "mp="+mp[i], "ap="+ap[i].toFixed(3));
}
// 笛卡尔处 alpha
for(let rn=0.518; rn<=0.522; rn+=0.002){
  const rp=rn*R, ang=2.0;
  const x=Math.round(cx+Math.cos(ang)*rp), y=Math.round(cy+Math.sin(ang)*rp);
  const i=y*S+x;
  console.log("笛卡尔 rn="+rn.toFixed(3), "alpha="+res.alpha[i]);
}
