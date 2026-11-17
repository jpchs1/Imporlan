/* Client attribution and photo provenance are independent. */
(function(){
'use strict';
if(!/^\/(?:test\/)?(?:index\.html)?$/.test(location.pathname))return;
var base=new URL('../images/importaciones-reales/',document.currentScript.src).href;
var boats=[
{name:'Beneteau Oceanis 281',client:'Alberto Lathrop',year:'1999',type:'Velero',period:'2019',file:'beneteau-oceanis-281.jpg',position:'50% 100%',alt:'Beneteau Oceanis 281 de Alberto Lathrop en una marina',story:'Un clásico a vela y una historia de confianza. Alberto importó su Beneteau con Imporlan y volvió a elegirnos para su siguiente embarcación.'},
{name:'Yamaha 242 Limited',type:'Lancha deportiva',file:'yamaha-242-limited.jpg',position:'50% 54%',alt:'Yamaha azul y blanca sobre su carro en bodega',story:'Del origen al destino, cada embarcación tiene su recorrido. Una fotografía de nuestro archivo de importaciones.'},
{name:'Monterey 180 FS',type:'Bowrider',file:'monterey-180-fs.jpg',alt:'Monterey azul y blanca junto al muelle',story:'Una embarcación, nuevos destinos. Una de las fotografías conservadas en nuestro archivo de importaciones.'},
{name:'Crownline',type:'Lancha cabinada',file:'crownline.jpg',position:'50% 57%',alt:'Crownline blanca y verde sobre carro en el puerto',story:'Cada etapa forma parte de la historia. Fotografía real de la embarcación en el puerto.'},
{name:'Donzi',type:'Lancha deportiva',file:'donzi.jpg',position:'50% 72%',alt:'Donzi roja y blanca sobre carro de transporte',story:'Líneas clásicas y carácter deportivo. Fotografía real de una embarcación de nuestro archivo.'},
{name:'Sea Ray 185 Sport',client:'Tomás Vial',year:'2008',type:'Bowrider',period:'2017–2018',file:'sea-ray-185-referencia.jpg',reference:true,source:'https://boats-from-usa.com/sea-ray/sea-ray-185-sport-37841',alt:'Imagen referencial de una Sea Ray 185 Sport 2008; no es la unidad importada',story:'Una de las primeras historias de nuestro recorrido. La importación de Tomás forma parte de la trayectoria de Imporlan desde 2017.'},
{name:'Rinker 250 Fiesta Vee',client:'Cristian Ruiz',year:'2003',type:'Lancha cabinada',period:'2019',file:'rinker-250-referencia.jpg',reference:true,source:'https://boats-from-usa.com/rinker/rinker-fiesta-vee-250-19129',alt:'Imagen referencial de una Rinker 250 Fiesta Vee 2003; no es la unidad importada',story:'Una cabinada que forma parte de nuestra historia. Cristian nos confió la importación de su Rinker 250 Fiesta Vee en 2019.'},
{name:'Yamaha 242 Limited S',client:'Marcelo Nordio',year:'2012',type:'Lancha deportiva',period:'2020',file:'yamaha-242-s-referencia.jpg',reference:true,source:'https://boats-from-usa.com/yamaha/yamaha-242-limited-s-85313',alt:'Imagen referencial de una Yamaha 242 Limited S 2012; no es la unidad importada',story:'Otra historia sobre el agua. La Yamaha 242 Limited S de Marcelo se suma a las embarcaciones importadas a través de Imporlan.'}
];
var arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
function mount(){
if(document.getElementById('algunas-lanchas-importadas'))return true;
var anchor=document.getElementById('proceso-compra-enhanced');if(!anchor)return false;
var section=document.createElement('section');section.id='algunas-lanchas-importadas';section.setAttribute('aria-labelledby','importaciones-reales-title');
section.innerHTML='<div class="ir-container"><header class="ir-heading"><div><span class="ir-eyebrow"><i></i>Historias que ya navegan</span><h2 id="importaciones-reales-title">Algunas lanchas<br><span>importadas.</span></h2></div><div class="ir-heading-tools"><p>Detrás de cada embarcación,<br>una historia de confianza.</p><span class="ir-collection">8 embarcaciones · Un recorrido compartido</span></div></header><div class="ir-carousel" role="region" aria-roledescription="carrusel" aria-label="Embarcaciones e historias de clientes"><div class="ir-stage" id="ir-stage" role="group" aria-roledescription="diapositiva"><div class="ir-visual"><button class="ir-photo" type="button"><img decoding="async"><span class="ir-loading" role="status">Cargando fotografía…</span><span class="ir-zoom">Ver fotografía '+arrow+'</span></button><span class="ir-badge"></span></div><article class="ir-detail"><span class="ir-category"></span><h3></h3><div class="ir-owner"></div><p class="ir-story"></p><dl class="ir-facts"></dl><p class="ir-provenance"></p><a class="ir-text-link" href="/cotizador-importacion/">Quiero importar una así '+arrow+'</a></article></div><div class="ir-controls"><div class="ir-counter" aria-live="polite" aria-atomic="true"></div><div class="ir-progress" aria-hidden="true"><span></span></div><div class="ir-arrows"><button type="button" class="ir-prev" aria-label="Embarcación anterior">'+arrow+'</button><button type="button" class="ir-next" aria-label="Siguiente embarcación">'+arrow+'</button></div></div><div class="ir-browse"><span>Elige tu próxima historia</span><small class="ir-desktop-hint">← → Explora con el teclado</small><small class="ir-mobile-hint">Desliza la foto para explorar</small></div><div class="ir-thumbs" aria-label="Elegir embarcación">'+boats.map(function(b,i){return '<button type="button" data-ir-index="'+i+'" aria-label="Ver '+b.name+(b.client?' de '+b.client:'')+'"><img src="'+base+b.file+'" alt="" loading="lazy"><span><strong>'+b.name+'</strong><small>'+(b.client||'Archivo Imporlan')+'</small></span></button>';}).join('')+'</div></div><div class="ir-more"><div><span class="ir-eyebrow">También forman parte de nuestra historia</span><p>Clientes que confiaron en Imporlan.</p></div><div class="ir-client"><span class="ir-avatar">IM</span><div><strong>Ingrid Ibáñez y Marcos Olivares</strong><small>Maxum 2200 SR · 2004</small></div></div><div class="ir-client"><span class="ir-avatar">MB</span><div><strong>Michael Brett</strong><small>Donzi Sweet 16</small></div></div></div><div class="ir-bottom"><div><span>La próxima historia puede ser la tuya.</span><p>Encuentra tu embarcación. Nosotros te acompañamos.</p></div><a href="/cotizador-importacion/">Cotizar mi importación '+arrow+'</a></div></div>';
anchor.insertAdjacentElement('afterend',section);
var dialog=document.createElement('dialog');dialog.className='ir-dialog';dialog.setAttribute('aria-labelledby','ir-dialog-title');dialog.innerHTML='<button type="button" class="ir-close" aria-label="Cerrar fotografía">×</button><img alt=""><p id="ir-dialog-title"></p>';document.body.appendChild(dialog);
var current=0,startX=0,startY=0,swiping=false,image=section.querySelector('.ir-photo img'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
var photo=section.querySelector('.ir-photo'),loading=section.querySelector('.ir-loading');
function imageState(state){
photo.classList.toggle('ir-is-loading',state==='loading');photo.classList.toggle('ir-load-error',state==='error');
photo.disabled=state!=='ready';photo.setAttribute('aria-busy',String(state==='loading'));
loading.textContent=state==='error'?'No pudimos cargar esta fotografía. Elige otra embarcación.':'Cargando fotografía…';
}
image.addEventListener('load',function(){imageState('ready');});
image.addEventListener('error',function(){imageState('error');});
dialog.addEventListener('close',function(){photo.focus({preventScroll:true});});
function render(index,scroll){
current=(index+boats.length)%boats.length;var b=boats[current];
section.querySelector('.ir-stage').setAttribute('aria-label',(current+1)+' de '+boats.length+': '+b.name);
section.querySelector('.ir-category').textContent=b.type;section.querySelector('h3').textContent=b.name;
section.querySelector('.ir-owner').innerHTML=b.client?'<span class="ir-avatar">'+b.client.split(' ').map(function(s){return s[0];}).slice(0,2).join('')+'</span><div><small>Importado para</small><strong>'+b.client+'</strong></div>':'<span class="ir-avatar ir-archive">↗</span><div><small>Desde nuestro archivo</small><strong>Una historia Imporlan</strong></div>';
section.querySelector('.ir-story').textContent=b.story;
section.querySelector('.ir-facts').innerHTML=(b.year?'<div><dt>Año del modelo</dt><dd>'+b.year+'</dd></div>':'')+(b.period?'<div><dt>Importación</dt><dd>'+b.period+'</dd></div>':'<div><dt>Registro</dt><dd>Archivo fotográfico</dd></div>');
section.querySelector('.ir-badge').textContent=b.reference?'Imagen referencial':'Fotografía real';section.querySelector('.ir-visual').classList.toggle('ir-reference',!!b.reference);
section.querySelector('.ir-provenance').innerHTML=b.reference?'Imagen de otra unidad del mismo modelo. <a href="'+b.source+'" target="_blank" rel="noopener noreferrer">Ver fuente ↗</a>':'Fotografía original del archivo de Imporlan.';
section.querySelector('.ir-counter').innerHTML='<strong>'+String(current+1).padStart(2,'0')+'</strong><span> / '+String(boats.length).padStart(2,'0')+'</span><span class="ir-current-name">'+b.name+'</span>';
section.querySelector('.ir-progress span').style.width=((current+1)/boats.length*100)+'%';
section.querySelectorAll('[data-ir-index]').forEach(function(el,i){el.setAttribute('aria-pressed',String(i===current));});
if(image.src!==base+b.file)imageState('loading');
image.src=base+b.file;image.alt=b.alt;image.style.objectPosition=b.position||'50% 50%';section.querySelector('.ir-photo').setAttribute('aria-label','Ampliar fotografía de '+b.name);
if(image.complete&&image.naturalWidth>0)imageState('ready');
if(scroll&&!reduced.matches&&typeof section.querySelector('.ir-detail').animate==='function')section.querySelector('.ir-detail').animate([{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
if(scroll){var thumb=section.querySelector('[data-ir-index="'+current+'"]'),rail=section.querySelector('.ir-thumbs');rail.scrollTo({left:thumb.offsetLeft-rail.offsetLeft-16,behavior:reduced.matches?'instant':'smooth'});}
}
section.addEventListener('click',function(e){
if(e.target.closest('.ir-next'))render(current+1,true);
if(e.target.closest('.ir-prev'))render(current-1,true);
var thumb=e.target.closest('[data-ir-index]');if(thumb)render(Number(thumb.dataset.irIndex),true);
if(e.target.closest('.ir-photo')){
if(swiping){swiping=false;return;}
if(typeof dialog.showModal!=='function'){window.open(image.src,'_blank','noopener');return;}
dialog.querySelector('img').src=image.src;dialog.querySelector('img').alt=image.alt;dialog.querySelector('p').textContent=boats[current].name+(boats[current].reference?' · Imagen referencial de otra unidad':' · Archivo Imporlan');dialog.showModal();
}
});
section.querySelector('.ir-carousel').addEventListener('keydown',function(e){
if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();render(current+(e.key==='ArrowRight'?1:-1),true);}
if(e.key==='Home'||e.key==='End'){e.preventDefault();render(e.key==='Home'?0:boats.length-1,true);}
});
var visual=section.querySelector('.ir-visual');
visual.addEventListener('touchstart',function(e){swiping=false;startX=e.changedTouches[0].clientX;startY=e.changedTouches[0].clientY;},{passive:true});
visual.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){swiping=true;render(current+(dx<0?1:-1),true);}},{passive:true});
dialog.querySelector('button').addEventListener('click',function(){dialog.close();});
dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close();});
render(0,false);return true;
}
function init(){if(mount())return;var observer=new MutationObserver(function(){if(mount())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(function(){observer.disconnect();},20000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
