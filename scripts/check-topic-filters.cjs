const {chromium}=require('C:/Users/emmmm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {installFixtures,records}=require('./review-fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
process.env.REVIEW_LOCAL_FILES='1';
records[0].tags=['机器学习','神经网络','训练','Python'];records[1].tags=['量子物理'];records[2].tags=['教育','思考'];records[3].tags=['开源','周报'];
async function checkTagNavigation(page) {
  await page.goto('http://blog.test/article.html?slug=review-0');
  await page.getByRole('link', {name:'#Python', exact:true}).click();
  assert.equal(new URL(page.url()).searchParams.get('tag'), 'Python');
  await page.waitForFunction(() => document.querySelectorAll('#articleList .article-list-card').length === 1);
  await page.locator('#moreFiltersToggle').click();
  const tag = page.locator('#tagFilters [data-tag="Python"]');
  assert.equal(await tag.textContent(), '# Python · 1 篇');
  assert.equal(await tag.getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await page.locator('#clearFilters').click();
  for (const [query, count] of [['python', 1], ['永劫无间', 3]]) {
    await page.locator('#articleSearch').fill(query);
    await page.waitForFunction(expected =>
      new URL(location.href).searchParams.get('q') === expected.query &&
      document.querySelectorAll('#articleList .article-list-card').length === expected.count,
      {query, count});
  }
}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});fs.mkdirSync('screenshots/topic-filters',{recursive:true});
try{for(const width of [320,390,1440]){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});await context.addInitScript(()=>localStorage.setItem('hutao-theme','dark'));await context.route('**/*',r=>r.abort());await installFixtures(context,{origin:'http://blog.test'});if(process.env.TOPIC_PUBLICATION==='1') await context.route('http://blog.test/articles.html',r=>r.fulfill({body:fs.readFileSync('outputs/topic-publication/articles.html'),contentType:'text/html'}));const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://blog.test/articles.html');await page.waitForFunction(()=>document.querySelectorAll('#topicFilters button').length===9);await page.locator('#topicFilters').scrollIntoViewIfNeeded();
assert.equal(await page.locator('#articleList .article-list-card').count(),5);
await checkTagNavigation(page);
await page.locator('#clearFilters').click();
await page.getByRole('button',{name:'AI 学习',exact:true}).click();await page.waitForTimeout(400);assert.equal(await page.locator('#articleList .article-list-card').count(),1);
await page.getByRole('button',{name:'神经网络',exact:true}).click();await page.waitForTimeout(400);assert.equal(await page.locator('#articleList .article-list-card').count(),1);
await page.locator('#moreFiltersToggle').click();await page.locator('#keywordSearch').fill('Python');assert.equal(await page.locator('#tagFilters button:visible').count(),1);await page.locator('#tagFilters button:visible').click();await page.waitForTimeout(400);assert.match(await page.locator('#articleResultCount').textContent(),/1/);
await page.screenshot({path:`screenshots/topic-filters/${width}-keywords.png`});await page.locator('#keywordSearch').fill('不存在');assert(await page.locator('#keywordEmpty').isVisible());await page.locator('#clearKeywords').click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'设计创作',exact:true}).click();await page.locator('#articleSearch').fill('没有这篇文章');await page.waitForTimeout(500);assert.match(await page.locator('#articleResultCount').textContent(),/0/);await page.locator('#clearFilters').click();await page.waitForTimeout(400);assert.equal(await page.locator('#articleList .article-list-card').count(),5);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert(await page.locator('.theme-filter-bar').evaluate(e=>e.getBoundingClientRect().height<65));assert.deepEqual(errors,[]);await page.screenshot({path:`screenshots/topic-filters/${width}-default.png`});console.log(`${width}px: passed`);await context.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

