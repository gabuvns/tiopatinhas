import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {build} from 'esbuild';
globalThis.crypto = webcrypto;
const compiled = await build({entryPoints:['src/store.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {createExportSnapshot,saveExportSnapshot,loadData,validateData} = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const memory = new Map();
globalThis.indexedDB = {open(){throw new Error('unavailable');}};
globalThis.localStorage = {getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
const now = new Date();
const date = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
const base={date,createdAt:now.toISOString()};
const original={schemaVersion:2,updatedAt:base.createdAt,settings:{currency:'BRL',milestones:[50000]},events:[
  {...base,id:'position',type:'opening_position',assetId:'TEST',ticker:'TEST',name:'Test',geography:'Exterior',assetClass:'Stocks',
    currency:'USD',quantity:2,marketPrice:10,averageCost:null,precision:0},
  {...base,id:'fx',type:'quote',assetId:'FX:USD/BRL',ticker:'USD/BRL',price:5,currency:'BRL',source:'Test',fetchedAt:base.createdAt},
  {...base,id:'property',type:'illiquid_valuation',assetId:'house',name:'House',assetClass:'Imóveis',amount:30},
  {...base,id:'legacy',type:'wealth_snapshot',totalValue:9999},
]};
const proposed=createExportSnapshot(original);
assert.equal(original.events.length,4,'Do not mutate the original history');
const first=proposed.events[proposed.events.length-1];
assert.equal(first.origin,'export');
assert.equal(first.totalValue,130,'Use current holdings rather than the last historical total');
assert.equal(first.liquidValue,100);
assert.equal(first.illiquidValue,30);
assert.equal(first.date,date);
assert.ok(Number.isFinite(Date.parse(first.createdAt)));
const saved=await saveExportSnapshot(original);
assert.deepEqual((await loadData()).events,saved.events,'Snapshot saved before file generation');
const twice=await saveExportSnapshot(saved);
const exported=twice.events.filter(event=>event.origin==='export');
assert.equal(exported.length,2,'Every export creates a new snapshot, even on the same day');
assert.notEqual(exported[0].id,exported[1].id);
assert.deepEqual(validateData(JSON.parse(JSON.stringify(twice))).events,twice.events,'Export file round-trip includes its new snapshot');
const price={...base,id:'new-price',type:'quote',assetId:'TEST',ticker:'TEST',price:20,currency:'USD',source:'Test',fetchedAt:new Date().toISOString()};
const changed=createExportSnapshot({...twice,events:[...twice.events,price]});
assert.equal(changed.events[changed.events.length-1].totalValue,230);
assert.equal(exported[0].totalValue,130,'Past snapshots remain immutable when prices change');
globalThis.localStorage.setItem=()=>{throw new Error('Storage full');};
await assert.rejects(saveExportSnapshot(original),/Storage full/,'No successful export if snapshot cannot be saved');
console.log('Export snapshot checks passed: calculation, persistence, repeated exports, JSON round-trip, immutable history and save failures.');
