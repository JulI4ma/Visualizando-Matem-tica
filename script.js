const $=i=>document.getElementById(i);
const X0=.5,X1=10,Y0=.5,Y1=10;
const foto=$('foto'),fc=foto.getContext('2d'),graf=$('graf'),gc=graf.getContext('2d');
const base=document.createElement('canvas'),bc=base.getContext('2d',{willReadFrequently:true});
let stream=null,manual=[],pts=[],fit=null,sel='const';

const sum=a=>a.reduce((s,v)=>s+v,0);
const fmt=n=>{const v=+Number(n).toPrecision(3);return (Object.is(v,-0)?'0':String(v)).replace('.',',')};
const sg=n=>(n<0?'− ':'+ ')+fmt(Math.abs(n));

/* ---------- Modelos: f, derivada e integral ---------- */
const MOD={
 const:{nome:'Constante',k:1,
  f:p=>p[0], d:()=>0, I:(p,x)=>p[0]*x,
  tf:p=>`f(x) = ${fmt(p[0])}`, td:()=>`f′(x) = 0`, ti:p=>`∫f dx = ${fmt(p[0])}·x + C`,
  uso:'Linhas horizontais: o horizonte, o tampo de uma mesa, o nível da água num copo. O valor não muda, então a taxa de variação (derivada) é zero e a área cresce em linha reta.'},
 afim:{nome:'Afim',k:2,
  f:(p,x)=>p[0]*x+p[1], d:p=>p[0], I:(p,x)=>p[0]*x*x/2+p[1]*x,
  tf:p=>`f(x) = ${fmt(p[0])}x ${sg(p[1])}`, td:p=>`f′(x) = ${fmt(p[0])}`, ti:p=>`∫f dx = ${fmt(p[0]/2)}x² ${sg(p[1])}x + C`,
  uso:'Rampas, escadas, telhados e corrimãos. A derivada é a inclinação, que é a mesma em todo o trecho. Corridas de táxi com bandeirada também são afins.'},
 quad:{nome:'Quadrática',k:3,
  f:(p,x)=>p[0]*x*x+p[1]*x+p[2], d:(p,x)=>2*p[0]*x+p[1], I:(p,x)=>p[0]*x**3/3+p[1]*x*x/2+p[2]*x,
  tf:p=>`f(x) = ${fmt(p[0])}x² ${sg(p[1])}x ${sg(p[2])}`, td:p=>`f′(x) = ${fmt(2*p[0])}x ${sg(p[1])}`, ti:p=>`∫f dx = ${fmt(p[0]/3)}x³ ${sg(p[1]/2)}x² ${sg(p[2])}x + C`,
  uso:'Pontes em arco, antenas parabólicas, jato de água, bola lançada. A derivada zera no ponto mais alto (ou mais baixo), onde a tangente fica horizontal.'},
 exp:{nome:'Exponencial',k:2,
  f:(p,x)=>p[0]*Math.exp(p[1]*x), d:(p,x)=>p[0]*p[1]*Math.exp(p[1]*x), I:(p,x)=>p[0]/p[1]*Math.exp(p[1]*x),
  tf:p=>`f(x) = ${fmt(p[0])}·e^(${fmt(p[1])}x)`, td:p=>`f′(x) = ${fmt(p[0]*p[1])}·e^(${fmt(p[1])}x)`, ti:p=>`∫f dx = ${fmt(p[0]/p[1])}·e^(${fmt(p[1])}x) + C`,
  uso:'Juros compostos, crescimento de bactérias, café esfriando, carga de bateria. A derivada é proporcional à própria função: quanto mais tem, mais rápido muda.'},
 log:{nome:'Logarítmica',k:2,
  f:(p,x)=>p[0]*Math.log(x)+p[1], d:(p,x)=>p[0]/x, I:(p,x)=>p[0]*(x*Math.log(x)-x)+p[1]*x,
  tf:p=>`f(x) = ${fmt(p[0])}·ln(x) ${sg(p[1])}`, td:p=>`f′(x) = ${fmt(p[0])}/x`, ti:p=>`∫f dx = ${fmt(p[0])}(x·ln x − x) ${sg(p[1])}x + C`,
  uso:'Volume em decibéis, terremotos na escala Richter, pH, a sensação de brilho. Cresce rápido no começo e desacelera: a derivada diminui conforme x aumenta.'}
};
const ORDEM=['const','afim','log','exp','quad'];

/* ---------- Ajuste por mínimos quadrados ---------- */
function lin(xs,ys){const n=xs.length,mx=sum(xs)/n,my=sum(ys)/n;let sxy=0,sxx=0;
 for(let i=0;i<n;i++){sxy+=(xs[i]-mx)*(ys[i]-my);sxx+=(xs[i]-mx)**2}
 const a=sxx?sxy/sxx:0;return[a,my-a*mx]}
function quad(xs,ys){
 const S=k=>sum(xs.map(x=>x**k)),T=k=>sum(xs.map((x,i)=>x**k*ys[i]));
 const A=[[S(4),S(3),S(2),T(2)],[S(3),S(2),S(1),T(1)],[S(2),S(1),S(0),T(0)]];
 for(let i=0;i<3;i++){let m=i;for(let r=i+1;r<3;r++)if(Math.abs(A[r][i])>Math.abs(A[m][i]))m=r;
  [A[i],A[m]]=[A[m],A[i]];if(Math.abs(A[i][i])<1e-12)return[0,...lin(xs,ys)];
  for(let r=0;r<3;r++)if(r!==i){const f=A[r][i]/A[i][i];for(let c=i;c<4;c++)A[r][c]-=f*A[i][c]}}
 return[0,1,2].map(i=>A[i][3]/A[i][i])}
function ajustar(P){
 const xs=P.map(p=>p.x),ys=P.map(p=>p.y),n=xs.length,my=sum(ys)/n,sst=sum(ys.map(y=>(y-my)**2));
 const ps={const:[my],afim:lin(xs,ys),quad:quad(xs,ys),log:lin(xs.map(Math.log),ys)};
 let[b,la]=lin(xs,ys.map(Math.log));if(Math.abs(b)<1e-6)b=1e-6;ps.exp=[Math.exp(la),b];
 const res={};
 for(const k in MOD){const p=ps[k],sse=sum(xs.map((x,i)=>(ys[i]-MOD[k].f(p,x))**2));
  const r2=sst<1e-9?(k==='const'?1:0):1-sse/sst;
  res[k]={p,r2,adj:1-(1-r2)*(n-1)/(n-MOD[k].k)}}
 return res}
function melhor(res){const mx=Math.max(...ORDEM.map(k=>res[k].adj));return ORDEM.find(k=>res[k].adj>=mx-.02)}

/* ---------- Extração do contorno da imagem ---------- */
const toMath=q=>({x:X0+(X1-X0)*q.px/base.width,y:Y0+(Y1-Y0)*(1-q.py/base.height)});
const toPy=y=>(1-(y-Y0)/(Y1-Y0))*base.height;
function auto(){
 const sw=80,sh=Math.max(20,Math.round(80*base.height/base.width)),c=document.createElement('canvas');
 c.width=sw;c.height=sh;const x=c.getContext('2d');x.drawImage(base,0,0,sw,sh);
 const d=x.getImageData(0,0,sw,sh).data;
 const g=(cx,r)=>{const i=(r*sw+cx)*4;return .3*d[i]+.59*d[i+1]+.11*d[i+2]};
 const rows=[];
 for(let cx=0;cx<sw;cx++){let best=0,br=-1;
  for(let r=1;r<sh-1;r++){const v=Math.abs(g(cx,r+1)-g(cx,r-1));if(v>best){best=v;br=r}}
  rows.push(best>14?br:null)}
 const out=[];
 for(let cx=0;cx<sw;cx++){const w=[];for(let k=-2;k<=2;k++){const v=rows[cx+k];if(v!=null)w.push(v)}
  if(w.length>=3){w.sort((a,b)=>a-b);out.push({px:(cx+.5)/sw*base.width,py:(w[w.length>>1]+.5)/sh*base.height})}}
 return out}

/* ---------- Câmera ---------- */
function msg(t){$('msg').textContent=t}
async function abrirCamera(){
 if(!navigator.mediaDevices?.getUserMedia){msg('Este navegador não liberou a câmera. Abra o site pelo Live Server (localhost) ou use "Enviar uma foto".');return}
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  $('vid').srcObject=stream;$('camBox').hidden=false;$('perm').hidden=true;msg('')
 }catch(e){
  msg(e.name==='NotAllowedError'?'Permissão negada. Libere a câmera no ícone de cadeado da barra de endereço e tente de novo, ou envie uma foto.':'Não foi possível abrir a câmera ('+e.name+'). Você pode enviar uma foto.')}}
function fecharCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('camBox').hidden=true;$('perm').hidden=false}
function carregar(src,w,h){
 const s=Math.min(1,640/w);base.width=foto.width=Math.round(w*s);base.height=foto.height=Math.round(h*s);
 bc.drawImage(src,0,0,base.width,base.height);
 manual=[];$('sAn').hidden=false;$('sRes').hidden=false;analisar();
 $('sAn').scrollIntoView({behavior:'smooth'})}
$('bCam').onclick=abrirCamera;
$('bFecha').onclick=fecharCamera;
$('bShot').onclick=()=>{const v=$('vid');carregar(v,v.videoWidth,v.videoHeight);fecharCamera()};
$('bNova').onclick=()=>{$('sAn').hidden=true;$('sRes').hidden=true;abrirCamera();window.scrollTo({top:0,behavior:'smooth'})};
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();
 im.onload=()=>{carregar(im,im.naturalWidth,im.naturalHeight);URL.revokeObjectURL(im.src)};im.src=URL.createObjectURL(f)};

/* ---------- Análise e desenho ---------- */
function analisar(){
 pts=($('modo').value==='auto'?auto():manual).slice();
 $('aviso').textContent='';
 if(pts.length<4){fit=null;
  $('aviso').textContent=$('modo').value==='auto'?'Não encontrei um contorno claro. Tente uma foto com mais contraste ou marque os pontos com o clique.':'Clique sobre o contorno para marcar ao menos 4 pontos.';
  drawFoto();gc.clearRect(0,0,graf.width,graf.height);['tf','td','ti','rank','leit'].forEach(i=>$(i).textContent='');return}
 const res=ajustar(pts.map(toMath));
 sel=$('modelo').value==='auto'?melhor(res):$('modelo').value;
 fit={res,p:res[sel].p};
 const M=MOD[sel],p=fit.p;
 $('tit').textContent=`${$('modelo').value==='auto'?'Melhor ajuste':'Modelo escolhido'}: função ${M.nome.toLowerCase()} (R² = ${fmt(res[sel].r2)})`;
 $('tf').textContent=M.tf(p);$('td').textContent=M.td(p);$('ti').textContent=M.ti(p);$('uso').textContent=M.uso;
 $('rank').innerHTML=ORDEM.map(k=>`<div class="rk ${k===sel?'on':''}"><span>${MOD[k].nome}</span><span class="bar"><b style="width:${Math.max(0,Math.min(1,res[k].r2))*100}%"></b></span><span>${fmt(res[k].r2)}</span></div>`).join('');
 drawFoto();drawGraf()}

function drawFoto(){
 fc.drawImage(base,0,0);const w=foto.width,h=foto.height;
 fc.fillStyle='#00e5ff';fc.strokeStyle='#14213d';fc.lineWidth=1;
 pts.forEach(q=>{fc.beginPath();fc.arc(q.px,q.py,3.5,0,7);fc.fill();fc.stroke()});
 if(!fit)return;const M=MOD[sel],p=fit.p;
 fc.beginPath();let on=false;
 for(let px=0;px<=w;px+=2){const x=X0+(X1-X0)*px/w,py=toPy(M.f(p,x));
  if(!isFinite(py)||Math.abs(py)>1e4){on=false;continue}on?fc.lineTo(px,py):fc.moveTo(px,py);on=true}
 fc.strokeStyle='#fff';fc.lineWidth=6;fc.stroke();fc.strokeStyle='#ffd400';fc.lineWidth=3;fc.stroke();
 const t=+$('t').value,m=M.d(p,t),y=M.f(p,t),kx=w/(X1-X0),ky=h/(Y1-Y0);
 const cx=(t-X0)*kx,cy=toPy(y),sl=-m*ky/kx,dx=60/Math.sqrt(1+sl*sl);
 fc.beginPath();fc.moveTo(cx-dx,cy-sl*dx);fc.lineTo(cx+dx,cy+sl*dx);
 fc.strokeStyle='#fff';fc.lineWidth=6;fc.stroke();fc.strokeStyle='#d1327a';fc.lineWidth=3;fc.stroke();
 fc.beginPath();fc.arc(cx,cy,6,0,7);fc.fillStyle='#d1327a';fc.fill();fc.strokeStyle='#fff';fc.lineWidth=2;fc.stroke()}

function drawGraf(){
 const w=graf.width,h=graf.height;gc.clearRect(0,0,w,h);
 if(!fit)return;const M=MOD[sel],p=fit.p,I0=M.I(p,X0),N=240;
 const S=[['cf','#1f5fbf',x=>M.f(p,x)],['cd','#d1327a',x=>M.d(p,x)],['ci','#0e8f6b',x=>M.I(p,x)-I0]].filter(s=>$(s[0]).checked);
 if(!S.length)return;
 let mn=Infinity,mx=-Infinity;
 S.forEach(s=>{for(let i=0;i<=N;i++){const v=s[2](X0+(X1-X0)*i/N);if(isFinite(v)){mn=Math.min(mn,v);mx=Math.max(mx,v)}}});
 if(mn===mx){mn-=1;mx+=1}const pad=(mx-mn)*.08;mn-=pad;mx+=pad;
 const L=48,R=12,T=12,B=26,X=x=>L+(x-X0)/(X1-X0)*(w-L-R),Y=y=>h-B-(y-mn)/(mx-mn)*(h-T-B);
 gc.font='12px system-ui';gc.fillStyle='#5b6b85';gc.strokeStyle='#d3e0ee';gc.lineWidth=1;
 for(let i=0;i<=5;i++){const v=mn+(mx-mn)*i/5,y=Y(v);gc.beginPath();gc.moveTo(L,y);gc.lineTo(w-R,y);gc.stroke();gc.fillText(fmt(v),4,y+4)}
 for(let v=1;v<=10;v+=1){gc.fillText(v,X(v)-4,h-8)}
 gc.strokeStyle='#14213d';gc.lineWidth=1.5;gc.beginPath();gc.moveTo(L,T);gc.lineTo(L,h-B);gc.lineTo(w-R,h-B);gc.stroke();
 if(mn<0&&mx>0){gc.beginPath();gc.moveTo(L,Y(0));gc.lineTo(w-R,Y(0));gc.stroke()}
 const t=+$('t').value,base0=Math.min(Math.max(0,mn),mx);
 if($('cf').checked){gc.beginPath();gc.moveTo(X(X0),Y(base0));
  for(let x=X0;x<=t;x+=.05)gc.lineTo(X(x),Y(M.f(p,x)));gc.lineTo(X(t),Y(base0));gc.closePath();gc.fillStyle='rgba(31,95,191,.18)';gc.fill()}
 S.forEach(s=>{gc.beginPath();gc.strokeStyle=s[1];gc.lineWidth=3;
  for(let i=0;i<=N;i++){const x=X0+(X1-X0)*i/N,v=s[2](x);i?gc.lineTo(X(x),Y(v)):gc.moveTo(X(x),Y(v))}gc.stroke()});
 gc.strokeStyle='#14213d';gc.setLineDash([5,4]);gc.beginPath();gc.moveTo(X(t),T);gc.lineTo(X(t),h-B);gc.stroke();gc.setLineDash([]);
 S.forEach(s=>{gc.beginPath();gc.arc(X(t),Y(s[2](t)),5,0,7);gc.fillStyle=s[1];gc.fill()});
 $('leit').textContent=`x = ${fmt(t)}  |  f = ${fmt(M.f(p,t))}  |  f′ = ${fmt(M.d(p,t))} (inclinação da tangente rosa)  |  área sob f de 0,5 até x = ${fmt(M.I(p,t)-I0)}`}

/* ---------- Eventos ---------- */
foto.onclick=e=>{
 if($('modo').value!=='manual')return;
 const r=foto.getBoundingClientRect();
 manual.push({px:(e.clientX-r.left)*foto.width/r.width,py:(e.clientY-r.top)*foto.height/r.height});analisar()};
$('modo').onchange=()=>{manual=[];analisar()};
$('bLimpa').onclick=()=>{manual=[];analisar()};
$('modelo').onchange=analisar;
['cf','cd','ci'].forEach(i=>$(i).onchange=drawGraf);
$('t').oninput=()=>{drawFoto();drawGraf()};
