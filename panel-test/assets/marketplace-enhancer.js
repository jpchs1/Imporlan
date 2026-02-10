(function(){
"use strict";

var ALL_BOATS = [
  {name:"Cobalt R30",type:"Bowrider",year:2021,length:"30 ft",price:"$185,000",loc:"Vina del Mar, Chile",seller:"Juan P.",img:"https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=400&h=300&fit=crop"},
  {name:"Cobalt CS23",type:"Sport Boat",year:2022,length:"23 ft",price:"$125,000",loc:"Algarrobo, Chile",seller:"Carlos M.",img:"https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=400&h=300&fit=crop"},
  {name:"Cobalt A29",type:"Bowrider",year:2023,length:"29 ft",price:"$195,000",loc:"Lago Rapel, Chile",seller:"Maria L.",img:"https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop"},
  {name:"Cobalt R25",type:"Sport Boat",year:2022,length:"25 ft",price:"$145,000",loc:"Puerto Montt, Chile",seller:"Pedro S.",img:"https://images.unsplash.com/photo-1562281302-809108fd533c?w=400&h=300&fit=crop"},
  {name:"Chaparral 246 SSi",type:"Bowrider",year:2019,length:"24 ft",price:"$68,000",loc:"Vina del Mar, Chile",seller:"Andres R.",img:"https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400&h=300&fit=crop"},
  {name:"Sea Ray 240 Sundeck",type:"Bowrider",year:2020,length:"24 ft",price:"$75,000",loc:"Algarrobo, Chile",seller:"Roberto F.",img:"https://images.unsplash.com/photo-1559734840-f9509ee5677f?w=400&h=300&fit=crop"},
  {name:"Bayliner 185",type:"Bowrider",year:2018,length:"18 ft",price:"$33,000",loc:"Lago Rapel, Chile",seller:"Felipe G.",img:"https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=400&h=300&fit=crop"},
  {name:"Maxum 2100 SC",type:"Bowrider",year:2017,length:"21 ft",price:"$42,000",loc:"Concepcion, Chile",seller:"Claudia H.",img:"https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=400&h=300&fit=crop"},
  {name:"Monterey 224FS",type:"Bowrider",year:2020,length:"22 ft",price:"$62,000",loc:"Puerto Montt, Chile",seller:"Diego M.",img:"https://images.unsplash.com/photo-1588401273675-21144d14cf76?w=400&h=300&fit=crop"},
  {name:"Stingray 225LR",type:"Bowrider",year:2019,length:"22 ft",price:"$48,000",loc:"Vina del Mar, Chile",seller:"Camila V.",img:"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop"},
  {name:"Four Winns H260",type:"Bowrider",year:2021,length:"26 ft",price:"$95,000",loc:"Lago Villarrica, Chile",seller:"Nicolas C.",img:"https://images.unsplash.com/photo-1622397863158-40d68e4c6fd4?w=400&h=300&fit=crop"},
  {name:"Regal 2300",type:"Bowrider",year:2020,length:"23 ft",price:"$72,000",loc:"Algarrobo, Chile",seller:"Valentina M.",img:"https://images.unsplash.com/photo-1599687267812-35c05ff70ee9?w=400&h=300&fit=crop"},
  {name:"Sea Ray 210 SPX",type:"Bowrider",year:2021,length:"21 ft",price:"$58,000",loc:"Vina del Mar, Chile",seller:"Francisca S.",img:"https://images.unsplash.com/photo-1564762861003-0528e7289cf4?w=400&h=300&fit=crop"},
  {name:"Maxum 2400 SE",type:"Sport Cruiser",year:2005,length:"24 ft",price:"$32,000",loc:"Algarrobo, Chile",seller:"Juan Pablo",img:"https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=400&h=300&fit=crop"}
];

var MY_BOATS = [
  {name:"Maxum 2400 SE",type:"Sport Cruiser",year:2005,length:"24 ft",price:"$32,000",loc:"Algarrobo, Chile",img:"https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=400&h=300&fit=crop",hrs:620,cond:"Buena",status:"Activa",views:23,contacts:2}
];

function card(b){
  var ini=b.seller?b.seller[0]:"?";
  return '<div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);transition:all .2s" onmouseover="this.style.boxShadow=\'0 4px 16px rgba(0,0,0,.12)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.boxShadow=\'0 1px 3px rgba(0,0,0,.1)\';this.style.transform=\'none\'">'+
    '<div style="position:relative;height:200px;overflow:hidden;background:#e2e8f0">'+
      '<img src="'+b.img+'" alt="'+b.name+'" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">'+
    '</div>'+
    '<div style="padding:16px">'+
      '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">'+
        '<div><h3 style="font-size:16px;font-weight:700;color:#1e293b;margin:0">'+b.name+'</h3>'+
        '<p style="font-size:13px;color:#64748b;margin:4px 0 0">'+b.type+' - '+b.year+'</p></div>'+
        '<p style="font-size:18px;font-weight:700;color:#2563eb;margin:0;white-space:nowrap">'+b.price+'</p>'+
      '</div>'+
      '<div style="display:flex;gap:12px;font-size:13px;color:#64748b;margin-bottom:12px">'+
        '<span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>'+b.loc+'</span>'+
        '<span>'+b.length+'</span>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid #f1f5f9">'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          '<div style="width:28px;height:28px;border-radius:50%;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">'+ini+'</div>'+
          '<span style="font-size:13px;color:#475569">'+b.seller+'</span>'+
        '</div>'+
        '<button style="padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;color:#475569;transition:all .15s" onmouseover="this.style.background=\'#f8fafc\';this.style.borderColor=\'#2563eb\';this.style.color=\'#2563eb\'" onmouseout="this.style.background=\'#fff\';this.style.borderColor=\'#e2e8f0\';this.style.color=\'#475569\'">Ver Detalles</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function myCard(b){
  return '<div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:16px">'+
    '<div style="display:flex;gap:16px;padding:16px;flex-wrap:wrap">'+
      '<img src="'+b.img+'" alt="'+b.name+'" style="width:200px;height:140px;object-fit:cover;border-radius:10px;flex-shrink:0" onerror="this.style.display=\'none\'">'+
      '<div style="flex:1;min-width:240px">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px;margin-bottom:10px">'+
          '<div>'+
            '<h3 style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 4px">'+b.name+'</h3>'+
            '<p style="font-size:14px;color:#64748b;margin:0">'+b.type+' - '+b.year+' | '+b.length+'</p>'+
          '</div>'+
          '<div style="text-align:right">'+
            '<p style="font-size:22px;font-weight:700;color:#2563eb;margin:0">'+b.price+' USD</p>'+
            '<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#dcfce7;color:#16a34a;margin-top:4px">'+b.status+'</span>'+
          '</div>'+
        '</div>'+
        '<div style="display:flex;gap:16px;font-size:13px;color:#64748b;margin-bottom:10px;flex-wrap:wrap">'+
          '<span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>'+b.loc+'</span>'+
          '<span>'+b.hrs+' hrs motor</span>'+
          '<span>Condicion: '+b.cond+'</span>'+
        '</div>'+
        '<div style="display:flex;gap:20px;font-size:13px;color:#94a3b8">'+
          '<span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'+b.views+' visitas</span>'+
          '<span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72"/></svg>'+b.contacts+' contactos</span>'+
        '</div>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function run(){
  var main=document.querySelector("main");
  if(!main) return false;
  var h1=main.querySelector("h1");
  if(!h1||h1.textContent.trim()!=="Marketplace") return false;
  if(document.getElementById("mkt-enhanced")) return true;

  for(var c=0;c<main.children.length;c++){
    main.children[c].style.display="none";
  }

  var wrapper=document.createElement("div");
  wrapper.id="mkt-enhanced";
  wrapper.style.cssText="padding:24px;width:100%";

  var header='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">'+
    '<div><h1 style="font-size:28px;font-weight:800;color:#0f172a;margin:0">Marketplace</h1>'+
    '<p style="font-size:14px;color:#64748b;margin:4px 0 0">Compra y vende embarcaciones en nuestra comunidad</p></div>'+
    '<button style="display:flex;align-items:center;gap:6px;padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer" onclick="alert(\'Funcion disponible proximamente\')">'+
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Publicar Embarcacion</button>'+
  '</div>';

  var tabBar='<div style="display:flex;gap:0;border-bottom:1px solid #e2e8f0;margin-bottom:20px">'+
    '<button id="mkt-tab-comprar" style="font-weight:600;padding:10px 20px;background:none;border:none;border-bottom:2px solid #2563eb;color:#2563eb;cursor:pointer;font-size:14px">Comprar</button>'+
    '<button id="mkt-tab-mis" style="font-weight:500;padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;color:#64748b;cursor:pointer;font-size:14px">Mis Publicaciones</button>'+
  '</div>';

  var buyGrid='<div id="mkt-buy-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">';
  for(var k=0;k<ALL_BOATS.length;k++) buyGrid+=card(ALL_BOATS[k]);
  buyGrid+='</div>';

  var myGrid='<div id="mkt-my-grid" style="display:none">';
  for(var m=0;m<MY_BOATS.length;m++) myGrid+=myCard(MY_BOATS[m]);
  myGrid+='</div>';

  wrapper.innerHTML=header+tabBar+buyGrid+myGrid;
  main.appendChild(wrapper);

  document.getElementById("mkt-tab-comprar").addEventListener("click",function(e){
    e.preventDefault();e.stopPropagation();
    this.style.cssText="font-weight:600;padding:10px 20px;background:none;border:none;border-bottom:2px solid #2563eb;color:#2563eb;cursor:pointer;font-size:14px";
    document.getElementById("mkt-tab-mis").style.cssText="font-weight:500;padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;color:#64748b;cursor:pointer;font-size:14px";
    document.getElementById("mkt-buy-grid").style.display="grid";
    document.getElementById("mkt-my-grid").style.display="none";
  });

  document.getElementById("mkt-tab-mis").addEventListener("click",function(e){
    e.preventDefault();e.stopPropagation();
    this.style.cssText="font-weight:600;padding:10px 20px;background:none;border:none;border-bottom:2px solid #2563eb;color:#2563eb;cursor:pointer;font-size:14px";
    document.getElementById("mkt-tab-comprar").style.cssText="font-weight:500;padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;color:#64748b;cursor:pointer;font-size:14px";
    document.getElementById("mkt-buy-grid").style.display="none";
    document.getElementById("mkt-my-grid").style.display="block";
  });

  return true;
}

function watch(){
  var obs=new MutationObserver(function(){
    var h1=document.querySelector("main h1");
    if(h1&&h1.textContent.trim()==="Marketplace"){
      if(!document.getElementById("mkt-enhanced")){
        setTimeout(function(){if(!run()) setTimeout(run,500);},300);
      }
    } else {
      var el=document.getElementById("mkt-enhanced");
      if(el){
        var main=el.parentElement;
        el.remove();
        if(main){
          for(var c=0;c<main.children.length;c++){
            main.children[c].style.display="";
          }
        }
      }
    }
  });
  obs.observe(document.body,{childList:true,subtree:true});
  setTimeout(run,800);
}

if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",watch);} else {watch();}
})();
