// Paste this at the bottom of milkyway/index.html (before closing </script> or as separate script)
// It overrides the empty feed behavior so Vercel doesn't get stuck on offline state

(function() {
  const originalLoadFeed = window.loadFeed;
  if (!originalLoadFeed) return;

  window.loadFeed = async function() {
    try {
      await originalLoadFeed();
    } catch (e) {
      console.warn('feed retry', e);
    }
    // Force a second attempt after 2 seconds if still empty
    setTimeout(() => {
      const feed = document.getElementById('feed');
      if (feed && !feed.querySelector('.post') && !feed.querySelector('.mw-skeleton')) {
        originalLoadFeed().catch(() => {});
      }
    }, 2000);
  };
})();
