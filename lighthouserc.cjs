const profile = process.env.LHCI_PROFILE || 'mobile';
if (!['mobile', 'desktop'].includes(profile)) throw new Error('Invalid LHCI_PROFILE');
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/lighthouse-server.cjs',
      startServerReadyPattern: 'LHCI fixture server ready',
      startServerReadyTimeout: 15000,
      url: ['/', '/articles.html', '/article.html?slug=review-0', '/videos.html', '/article.html?slug=video-0', '/works.html']
        .map(route => 'http://127.0.0.1:4173' + route),
      numberOfRuns: 3,
      settings: {
        ...(profile === 'desktop' ? { preset: 'desktop' } : {}),
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        blockedUrlPatterns: ['https://*'],
        chromeFlags: '--headless --disable-gpu',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:accessibility': ['warn', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:seo': ['warn', { minScore: 0.95, aggregationMethod: 'median' }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
        'total-blocking-time': ['warn', { maxNumericValue: 200, aggregationMethod: 'median' }],
        'bootup-time': ['warn', { maxNumericValue: 2000, aggregationMethod: 'median' }],
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 4000, aggregationMethod: 'median' }],
      },
    },
    upload: { target: 'filesystem', outputDir: `.lighthouseci-reports/${profile}` },
  },
};
