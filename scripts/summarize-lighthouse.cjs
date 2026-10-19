// Export metrics only; never copy HTML, DOM, request URLs or response bodies.
const fs = require('node:fs');
const path = require('node:path');
const metrics = ['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'bootup-time', 'mainthread-work-breakdown'];
const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const profiles = process.argv[2] ? [process.argv[2]] : ['desktop', 'mobile'];
if (profiles.some(profile => !['desktop', 'mobile'].includes(profile))) throw new Error('Use desktop or mobile');
const rows = [];
for (const profile of profiles) {
  const dir = path.join('.lighthouseci-reports', profile, 'raw');
  if (!fs.existsSync(dir)) throw new Error(`Missing ${profile} reports`);
  const groups = new Map();
  for (const file of fs.readdirSync(dir).filter(file => /^lhr-.*\.json$/.test(file))) {
    const report = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (report.runtimeError) throw new Error('Lighthouse runtime error');
    if (report.configSettings?.formFactor !== profile) throw new Error(`Incorrect ${profile} emulation`);
    const url = new URL(report.requestedUrl);
    const route = url.pathname + url.search;
    if (!groups.has(route)) groups.set(route, []);
    groups.get(route).push(report);
  }
  if (groups.size !== 6) throw new Error(`Incomplete ${profile} collection`);
  for (const [route, reports] of groups) {
    if (reports.length !== 3) throw new Error(`Expected three runs for ${profile} ${route}`);
    const row = { profile, route, runs: reports.length, lighthouse: reports[0].lighthouseVersion };
    for (const category of ['performance', 'accessibility', 'seo']) {
      const values = reports.map(r => r.categories[category]?.score);
      if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error(`Missing ${category} score`);
      row[category] = median(values.map(value => Math.round(value * 100)));
    }
    for (const metric of metrics) {
      const values = reports.map(r => r.audits[metric]?.numericValue);
      if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error(`Missing ${metric} metric`);
      row[metric] = median(values);
    }
    rows.push(row);
  }
}
if (!rows.length) throw new Error('No collected reports; no baseline can be generated');
const summaryPath = profiles.length === 1
  ? path.join('.lighthouseci-reports', profiles[0], 'metrics.json')
  : '.lighthouseci-reports/metrics.json';
fs.writeFileSync(summaryPath, JSON.stringify(rows, null, 2) + '\n');
console.table(rows);
if (process.env.GITHUB_STEP_SUMMARY) {
  const format = value => Number(value.toFixed(2));
  const lines = ['| Profile | Route | Performance | Accessibility | SEO | LCP ms | CLS | TBT ms | JS ms |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(row => `| ${row.profile} | ${row.route} | ${row.performance} | ${row.accessibility} | ${row.seo} | ${format(row['largest-contentful-paint'])} | ${format(row['cumulative-layout-shift'])} | ${format(row['total-blocking-time'])} | ${format(row['bootup-time'])} |`)];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + lines.join('\n') + '\n');
}
