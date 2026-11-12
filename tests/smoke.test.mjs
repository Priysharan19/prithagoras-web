import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read = filename => fs.readFileSync(path.join(root,filename),'utf8');
const index = JSON.parse(read('resources.json'));
test('site entrypoints and asset references exist',()=>{
  for(const file of ['index.html','studio.html','desk.html','script.js','desk.js','session-core.mjs','desk.css','studio.js','styles.css','studio.css','favicon.svg','resources.json'])assert.ok(fs.existsSync(path.join(root,file)),file);
  for(const pair of [['index.html','script.js'],['index.html','styles.css'],['studio.html','studio.js'],['studio.html','studio.css'],['desk.html','desk.js'],['desk.html','desk.css']])assert.ok(read(pair[0]).includes(pair[1]),pair.join(' → '));
});
test('catalog schema is valid and resource IDs are unique',()=>{
  assert.equal(index.schemaVersion,1);
  assert.ok(Array.isArray(index.resources));
  const ids=new Set();
  for(const r of index.resources){
    assert.ok(/^[a-z0-9-]+$/.test(r.id),'safe slug');
    assert.ok(!ids.has(r.id),'duplicate '+r.id); ids.add(r.id);
    assert.ok(r.title.length>8 && r.description.length>20);
    assert.ok(['exam','solutions','notes'].includes(r.type),'resource type');
    assert.ok(Number.isInteger(r.year)&&r.year>=2024&&r.year<=2035);
    assert.ok(Array.isArray(r.tags));
    if(r.type==='exam') {
      assert.ok(Number.isInteger(r.questions)&&r.questions>=1&&r.questions<=200,'exam question count');
      assert.ok(Number.isInteger(r.readingMinutes)&&r.readingMinutes>=0&&r.readingMinutes<=90,'reading time');
      assert.ok(Number.isInteger(r.workingMinutes)&&r.workingMinutes>=1&&r.workingMinutes<=600,'working time');
      assert.ok(Array.isArray(r.sections)&&r.sections.length>0,'exam sections');
      const assigned=new Set();
      for(const section of r.sections){
        assert.ok(Number.isInteger(section.start)&&Number.isInteger(section.end),'section integer bounds');
        for(let q=section.start;q<=section.end;q++){
          assert.ok(q>=1&&q<=r.questions&&!assigned.has(q),'no overlap or out of range section');
          assigned.add(q);
        }
      }
      assert.equal(assigned.size,r.questions,'every question assigned to a section');
    }
    if(r.url.startsWith('./materials/')){
      const filename=decodeURIComponent(r.url.slice('./materials/'.length));
      assert.ok(filename.toLowerCase().endsWith('.pdf'),'material must be pdf');
      assert.ok(fs.existsSync(path.join(root,'materials',filename)),'PDF not checked in: '+filename);
    } else assert.equal(new URL(r.url).protocol,'https:','external URLs must use https');
  }
});
test('site uses no demo publishing claims or token requests',()=>{
  assert.ok(!read('index.html').includes('hello@prithagoras.com.au'));
  assert.ok(read('index.html').includes('PREVIEW'),'hero exam desk must be clearly labelled preview');
  assert.ok(read('index.html').includes('desk.html'),'practice links must be present');
  assert.ok(read('desk.html').includes('not automated marking'),'no marking claims');
  assert.ok(read('studio.html').includes('This studio does not upload documents automatically'));
  assert.ok(read('studio.html').includes('actual file is uploaded on GitHub'));
  assert.ok(!/personal access token|github_token|ghp_/i.test(read('studio.js')));
});
