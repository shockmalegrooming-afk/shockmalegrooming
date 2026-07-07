(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,2945,e=>{"use strict";async function t(e,t){let i="u">typeof sessionStorage?sessionStorage.getItem("admin_password")??"":"",r=await fetch(`/api/admin/${e}`,{...t,headers:{"Content-Type":"application/json","X-Admin-Password":i,...t?.headers??{}}});if(401===r.status)throw Error("401");if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}e.s(["adminFetch",0,t])},5425,e=>{"use strict";var t=e.i(43476),i=e.i(71645),r=e.i(2945);var jsx=t.jsx,jsxs=t.jsxs,uS=i.useState,uE=i.useEffect;
function Field(p){var st={width:"100%",padding:"10px 14px",background:"#141312",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#fff",fontSize:"0.88rem",marginBottom:14,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"};return jsxs("div",{children:[jsx("p",{style:{color:"rgba(255,255,255,0.5)",fontSize:"0.72rem",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"},children:p.label}),p.textarea?jsx("textarea",{style:{...st,minHeight:90},value:p.value,placeholder:p.placeholder,onChange:function(ev){p.onChange(ev.target.value);}}):jsx("input",{style:st,value:p.value,type:p.type||"text",placeholder:p.placeholder,onChange:function(ev){p.onChange(ev.target.value);}})]});}
function Loading(){return jsx("div",{style:{color:"rgba(255,255,255,0.3)",padding:40,textAlign:"center"},children:"Caricamento..."});}
var H2={fontSize:"1.2rem",fontWeight:700,color:"#fff"},CARD={background:"#1C1917",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"16px 20px"},OVL={position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:20,overflowY:"auto"},MODAL={background:"#2C2825",borderRadius:16,padding:28,width:"100%",maxWidth:640,margin:"auto"},BTN={background:"#0077A8",color:"#fff",border:"none",borderRadius:100,padding:"10px 20px",fontSize:"0.8rem",fontWeight:700,cursor:"pointer"},BTN2={background:"transparent",color:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:100,padding:"10px 20px",fontSize:"0.8rem",cursor:"pointer"},PILL={background:"rgba(0,119,168,0.15)",color:"#0077A8",border:"1px solid rgba(0,119,168,0.3)",borderRadius:100,padding:"6px 16px",fontSize:"0.75rem",fontWeight:600,cursor:"pointer",flexShrink:0};
e.s(["default",0,function(){
var _l0=uS([]),list=_l0[0],setList=_l0[1];
var _l1=uS(!0),loading=_l1[0],setLoading=_l1[1];
var _l2=uS(null),ed=_l2[0],setEd=_l2[1];
var _l3=uS(!1),busy=_l3[0],setBusy=_l3[1];
var _l4=uS(""),msg=_l4[0],setMsg=_l4[1];
var _l5=uS(!1),showNew=_l5[0],setShowNew=_l5[1];
var _l6=uS(0),prevK=_l6[0],setPrevK=_l6[1];
var _l7=uS({title:"",price:"",body_html:"",status:"active",imgUrl:""}),nf=_l7[0],setNf=_l7[1];
function load(){setLoading(!0);r.adminFetch("products.json?fields=id,title,handle,status,body_html,variants,images").then(function(d){setList(d.products||[]);}).finally(function(){setLoading(!1);});}
uE(function(){load();},[]);
function openEdit(p){var v=p.variants&&p.variants[0]||{};var price=parseFloat(v.price||0),cmp=parseFloat(v.compare_at_price||0);var full=cmp>price?cmp:price;var disc=cmp>price?String(price):"";setEd({...p,_full:String(full),_disc:disc});setPrevK(function(k){return k+1;});}
function save(){if(!ed)return;setBusy(!0);var full=parseFloat(ed._full||0);var d=ed._disc!==""&&ed._disc!=null?parseFloat(ed._disc):null;var useDisc=d!=null&&d>0&&d<full;var v0=ed.variants[0];var variant=useDisc?{id:v0.id,price:d.toFixed(2),compare_at_price:full.toFixed(2)}:{id:v0.id,price:full.toFixed(2),compare_at_price:null};r.adminFetch("products/"+ed.id+".json",{method:"PUT",body:JSON.stringify({product:{id:ed.id,title:ed.title,body_html:ed.body_html,status:ed.status,variants:[variant]}})}).then(function(){setMsg("Salvato!");setEd(null);load();}).catch(function(){setMsg("Errore nel salvataggio");}).finally(function(){setBusy(!1);setTimeout(function(){setMsg("");},3000);});}
function create(){setBusy(!0);r.adminFetch("products.json",{method:"POST",body:JSON.stringify({product:{title:nf.title,body_html:nf.body_html,status:nf.status,variants:[{price:nf.price}],...(nf.imgUrl?{images:[{src:nf.imgUrl}]}:{})}})}).then(function(){setMsg("Prodotto creato!");setShowNew(!1);setNf({title:"",price:"",body_html:"",status:"active",imgUrl:""});load();}).catch(function(){setMsg("Errore nella creazione");}).finally(function(){setBusy(!1);setTimeout(function(){setMsg("");},3000);});}
function del(id){if(!confirm("Eliminare questo prodotto? Azione irreversibile."))return;setBusy(!0);r.adminFetch("products/"+id+".json",{method:"DELETE"}).then(function(){setMsg("Prodotto eliminato!");load();}).catch(function(){setMsg("Errore nell'eliminazione");}).finally(function(){setBusy(!1);setTimeout(function(){setMsg("");},3000);});}
if(loading)return jsx(Loading,{});
var ef=ed?parseFloat(ed._full||0):0,edi=ed&&ed._disc!==""&&ed._disc!=null?parseFloat(ed._disc):null,edPct=edi!=null&&edi>0&&edi<ef?Math.round((1-edi/ef)*100):0;
return jsxs("div",{children:[
jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24},children:[jsx("h2",{style:H2,children:"Prodotti"}),jsx("button",{style:BTN,onClick:function(){setShowNew(!0);},children:"+ Nuovo Prodotto"})]}),
msg&&jsx("div",{style:{background:"rgba(0,119,168,0.2)",border:"1px solid rgba(0,119,168,0.4)",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#fff",fontSize:"0.85rem"},children:msg}),
showNew&&jsx("div",{style:OVL,children:jsxs("div",{style:MODAL,children:[
jsx("h3",{style:{color:"#fff",marginBottom:20,fontSize:"1rem"},children:"Nuovo Prodotto"}),
jsx(Field,{label:"Nome",value:nf.title,onChange:function(x){setNf({...nf,title:x});}}),
jsx(Field,{label:"Prezzo (€)",value:nf.price,onChange:function(x){setNf({...nf,price:x});}}),
jsx(Field,{label:"Descrizione",value:nf.body_html,onChange:function(x){setNf({...nf,body_html:x});},textarea:!0}),
jsx(Field,{label:"URL Foto (https://...jpg)",value:nf.imgUrl,onChange:function(x){setNf({...nf,imgUrl:x});}}),
jsx("div",{style:{display:"flex",gap:10,marginTop:4},children:jsxs("label",{style:{color:"rgba(255,255,255,0.6)",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:8,cursor:"pointer"},children:[jsx("input",{type:"checkbox",checked:"active"===nf.status,onChange:function(ev){setNf({...nf,status:ev.target.checked?"active":"draft"});}}),"Pubblica subito"]})}),
jsxs("div",{style:{display:"flex",gap:10,marginTop:20},children:[jsx("button",{style:BTN,onClick:create,disabled:busy,children:busy?"...":"Crea Prodotto"}),jsx("button",{style:BTN2,onClick:function(){setShowNew(!1);},children:"Annulla"})]})
]})}),
ed&&jsx("div",{style:OVL,children:jsxs("div",{style:{...MODAL,maxWidth:940},children:[
jsxs("h3",{style:{color:"#fff",marginBottom:20,fontSize:"1rem"},children:["Modifica: ",ed.title]}),
jsxs("div",{style:{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:24},children:[
jsxs("div",{children:[
jsx(Field,{label:"Nome",value:ed.title,onChange:function(x){setEd({...ed,title:x});}}),
jsxs("div",{style:{display:"flex",gap:12},children:[jsx("div",{style:{flex:1},children:jsx(Field,{label:"Prezzo pieno (€)",value:ed._full,type:"number",onChange:function(x){setEd({...ed,_full:x});}})}),jsx("div",{style:{flex:1},children:jsx(Field,{label:"Prezzo scontato (€)",placeholder:"vuoto = nessuno sconto",value:ed._disc,type:"number",onChange:function(x){setEd({...ed,_disc:x});}})})]}),
edPct>0&&jsxs("p",{style:{color:"#4CAF50",fontSize:"0.78rem",marginTop:-8,marginBottom:14},children:["🏷 Sconto -",edPct,"%: il prezzo pieno apparirà barrato sul sito"]}),
jsx(Field,{label:"Descrizione (HTML)",value:ed.body_html,onChange:function(x){setEd({...ed,body_html:x});},textarea:!0}),
jsx("div",{style:{marginTop:4},children:jsxs("label",{style:{color:"rgba(255,255,255,0.6)",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:8,cursor:"pointer"},children:[jsx("input",{type:"checkbox",checked:"active"===ed.status,onChange:function(ev){setEd({...ed,status:ev.target.checked?"active":"draft"});}}),"Pubblicato"]})}),
jsxs("div",{style:{display:"flex",gap:10,marginTop:20},children:[jsx("button",{style:BTN,onClick:save,disabled:busy,children:busy?"...":"Salva"}),jsx("button",{style:BTN2,onClick:function(){setEd(null);},children:"Annulla"})]})
]}),
jsxs("div",{children:[
jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},children:[jsx("p",{style:{color:"rgba(255,255,255,0.5)",fontSize:"0.72rem",textTransform:"uppercase",letterSpacing:"0.06em"},children:"Anteprima live"}),jsx("button",{style:{...PILL,padding:"4px 12px"},onClick:function(){setPrevK(prevK+1);},children:"🔄 Aggiorna"})]}),
ed.handle?jsx("iframe",{"data-k":prevK,src:"/prodotto?handle="+encodeURIComponent(ed.handle)+"&_="+prevK,style:{width:"100%",height:540,border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,background:"#0a0908"}},prevK):jsx("p",{style:{color:"rgba(255,255,255,0.3)",fontSize:"0.8rem"},children:"Nessuna anteprima disponibile."}),
jsx("p",{style:{color:"rgba(255,255,255,0.3)",fontSize:"0.7rem",marginTop:8},children:"L'anteprima riflette i dati salvati: premi Salva, poi Aggiorna."})
]})
]})
]})}),
jsx("div",{style:{display:"flex",flexDirection:"column",gap:10},children:list.map(function(p){var v=p.variants&&p.variants[0]||{};var price=parseFloat(v.price||0),cmp=parseFloat(v.compare_at_price||0),onSale=cmp>price;return jsxs("div",{style:{...CARD,display:"flex",alignItems:"center",gap:16},children:[
p.images&&p.images[0]?jsx("img",{src:p.images[0].src,alt:p.title,style:{width:56,height:56,objectFit:"cover",borderRadius:8,flexShrink:0}}):jsx("div",{style:{width:56,height:56,borderRadius:8,background:"rgba(0,119,168,0.2)",flexShrink:0}}),
jsxs("div",{style:{flex:1},children:[jsx("p",{style:{color:"#fff",fontWeight:600,fontSize:"0.9rem"},children:p.title}),jsxs("p",{style:{color:"rgba(255,255,255,0.4)",fontSize:"0.78rem",marginTop:2},children:[onSale?jsxs("span",{children:[jsxs("span",{style:{textDecoration:"line-through",opacity:.6},children:["€",cmp.toFixed(2)]})," ",jsxs("span",{style:{color:"#4CAF50",fontWeight:700},children:["€",price.toFixed(2)]})]}):jsxs("span",{children:["€",v.price]})," · Scorte: ",v.inventory_quantity," · ",jsx("span",{style:{color:"active"===p.status?"#4CAF50":"#FFA000"},children:"active"===p.status?"Attivo":"Bozza"})]})]}),
jsx("button",{style:PILL,onClick:function(){openEdit(p);},children:"Modifica"}),
jsx("button",{style:{...PILL,background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.25)"},onClick:function(){del(p.id);},children:"Elimina"})
]},p.id);})})
]});
}])}]);