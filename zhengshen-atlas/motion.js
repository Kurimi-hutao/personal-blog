(()=>{
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('details').forEach(details=>{
 const summary=details.querySelector(':scope > summary');if(!summary)return;
 const body=document.createElement('div');body.className='motion-details-content';while(summary.nextSibling)body.append(summary.nextSibling);details.append(body);details.classList.add('motion-details');let animation=null,fade=null,wanted=details.open;
 summary.addEventListener('click',event=>{
  event.preventDefault();wanted=!wanted;
  const wasClosed=!details.open;const start=details.getBoundingClientRect().height,opacity=getComputedStyle(body).opacity;animation?.cancel();fade?.cancel();
  if(reduced()){details.open=wanted;details.style.height='';return;}
  details.style.height='';details.open=true;
  const styles=getComputedStyle(details),closed=summary.getBoundingClientRect().height+parseFloat(styles.paddingTop)+parseFloat(styles.paddingBottom)+parseFloat(styles.borderTopWidth)+parseFloat(styles.borderBottomWidth);
  const end=wanted?details.getBoundingClientRect().height:closed;
  animation=details.animate([{height:start+'px'},{height:end+'px'}],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});
  fade=body.animate([{opacity:wanted&&wasClosed?0:opacity},{opacity:wanted?1:0}],{duration:220,easing:'ease-out'});details.dataset.visited='true';
  animation.onfinish=()=>{details.open=wanted;animation=null};
 });
});
document.addEventListener('click',e=>{const button=e.target.closest('[data-fold]');if(!button)return;const body=document.getElementById(button.getAttribute('aria-controls'));if(!body)return;const open=button.getAttribute('aria-expanded')!=='true';body.getBoundingClientRect();button.setAttribute('aria-expanded',String(open));body.classList.toggle('is-open',open);body.inert=!open;window.dispatchEvent(new CustomEvent('foldchange',{detail:{key:button.dataset.fold,open}}));});
})();
