
/* Phase B: language refresh, 3-step onboarding, share sheet */
(() => {
  const $ = id => document.getElementById(id);
  function applyExtra(){
    const lang = (document.documentElement.lang || 'sw').startsWith('en') ? 'en' : 'sw';
    document.querySelectorAll('[data-vl-sw][data-vl-en]').forEach(el => {
      el.textContent = el.getAttribute('data-vl-' + lang) || el.textContent;
    });
  }
  document.getElementById('langSel')?.addEventListener('change', () => setTimeout(applyExtra, 50));
  applyExtra();

  // 3-step onboarding, once
  if (!localStorage.getItem('mw_onboarded')) {
    const box = document.createElement('div');
    box.id = 'mwOnboard';
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(3,7,18,.72);display:grid;place-items:end center;padding:16px';
    const steps = [
      ['Karibu MilkyWay', 'Angalia posts, live na gallery bila kujiandikisha.'],
      ['Jisajili kushiriki', 'Like, comment, post na ujumbe vinahitaji akaunti.'],
      ['Orbit na Galaxy', 'Orbit ni feed. MilkyWay Galaxy ni akaunti yako.']
    ];
    let i = 0;
    const card = document.createElement('div');
    card.style.cssText = 'width:min(420px,100%);background:#fff;color:#17344d;border-radius:18px;padding:18px';
    const paint = () => {
      card.innerHTML = `<h3 style="margin:0 0 6px">${steps[i][0]}</h3><p style="margin:0 0 14px">${steps[i][1]}</p><button id="mwOnNext" style="width:100%;padding:12px;border:0;border-radius:12px;background:#087bd3;color:#fff;font-weight:800">${i===2?'Anza':'Endelea'}</button>`;
      card.querySelector('#mwOnNext').onclick = () => {
        i += 1;
        if (i >= steps.length) { localStorage.setItem('mw_onboarded','1'); box.remove(); }
        else paint();
      };
    };
    box.append(card);
    paint();
    document.body.append(box);
  }

  // Share helper
  window.mwShare = async (url, text) => {
    const link = url || location.href;
    const title = text || 'MilkyWay';
    if (navigator.share) { try { await navigator.share({ title, url: link }); return; } catch(e){} }
    const pick = prompt('Share: 1 WhatsApp, 2 Facebook, 3 X, 4 Copy', '1');
    if (pick === '1') location.href = 'https://wa.me/?text=' + encodeURIComponent(title + ' ' + link);
    else if (pick === '2') window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link), '_blank');
    else if (pick === '3') window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(title), '_blank');
    else { try { await navigator.clipboard.writeText(link); alert('Link copied'); } catch(e){ alert(link); } }
  };
})();
