const {test}=require('node:test'),assert=require('node:assert/strict');
const {trayStatusText}=require('./tray-status.cjs');
const status={name:'小叶',stage:4,sleeping:false,stats:{hunger:82.4,thirst:40.5,cleanliness:88,happiness:74,health:100,energy:20.1}};
test('tray hover text contains identity, activity and all six current stats',()=>{
 const text=trayStatusText(status);assert.match(text,/小叶 · 神力拉姆 · 陪伴中/);
 for(const label of ['饱食 82','水分 41','清洁 88','心情 74','健康 100','精力 20'])assert.ok(text.includes(label));
 assert.match(trayStatusText({...status,sleeping:true}),/睡觉中/);
 for(const [activity,label]of[['course','上课中'],['restaurant','打工中'],['outing','外出中']])assert.match(trayStatusText({...status,activity}),new RegExp(label));
 assert.equal(trayStatusText(null),'拉姆 · 等待领养');assert.ok(text.length<128,'fits legacy Windows tooltip limit');
});
test('tray rejects malformed renderer payloads instead of displaying stale or injected text',()=>{
 for(const bad of [undefined,[],{}, {...status,name:'x\n注入'}, {...status,stage:5}, {...status,sleeping:1}, {...status,activity:'unknown'}])assert.throws(()=>trayStatusText(bad));
 for(const key of Object.keys(status.stats))for(const value of [-1,101,NaN,Infinity,'40',null])assert.throws(()=>trayStatusText({...status,stats:{...status.stats,[key]:value}}));
});
