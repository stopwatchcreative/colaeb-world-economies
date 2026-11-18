/* Colaeb homepage hero orbit rings. Adapted from MotionSites "Orbit rings with counter-rotating avatars" (MIT, github.com/Motionsites-AI/claude-skill). Desktop only (>=992px); phones keep the stats card. */
(function(){
  var col=document.querySelector('.hp-hero-div-3');
  if(!col||col.querySelector('.co-orbit-wrap'))return;
  // Logos already shown in the homepage logo strip (unique by image), so nothing new is published.
  var seen={},logos=[];
  [].slice.call(document.querySelectorAll('img.hp-hero-img-2')).forEach(function(i){
    var s=i.currentSrc||i.src;if(!s||seen[s])return;seen[s]=1;logos.push({src:s,alt:i.alt||''});});
  if(logos.length<8)return;
  var rings=[{d:340,t:30,dir:'ccw',n:3,a0:270},{d:480,t:40,dir:'cw',n:5,a0:30},{d:620,t:50,dir:'cw',n:6,a0:10}];
  var glows=['rgba(46,204,113,.35)','rgba(243,122,35,.30)','rgba(110,181,255,.30)'];
  var html='<div class="co-orbits" aria-hidden="true">',k=0,delay=.6;
  rings.forEach(function(r,ri){
    html+='<div class="co-orbit" data-dir="'+r.dir+'" style="--d:'+r.d+'px;--t:'+r.t+'s">';
    for(var j=0;j<r.n&&k<logos.length;j++,k++){
      var a=(r.a0+j*360/r.n)%360,lg=(k%5===0),sq=(k%3===1);
      html+='<div class="co-item" style="--a:'+a+'deg;--r:'+(r.d/2)+'px"><div class="co-upright"><div class="co-pop'+(lg?' is-lg':'')+(sq?' is-sq':'')+
        '" style="--delay:'+delay.toFixed(2)+'s;--glow:'+glows[k%3]+'"><img src="'+logos[k].src+'" alt="" decoding="async"></div></div></div>';
      delay+=.12;
    }
    html+='</div>';
  });
  html+='<div class="co-center"><strong data-to="10">0K+</strong><span>Introductions made</span><em>Businesses worldwide</em></div></div>';
  var w=document.createElement('div');w.className='co-orbit-wrap';w.innerHTML=html;
  col.classList.add('co-has-orbit');col.appendChild(w);
  var el=w.querySelector('strong'),to=+el.getAttribute('data-to');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=to+'K+';return;}
  var t0=null,start=1200;
  setTimeout(function(){requestAnimationFrame(function step(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/2000,1),e=1-Math.pow(1-p,4);
    el.textContent=Math.round(to*e)+'K+';if(p<1)requestAnimationFrame(step);});},start);
})();
