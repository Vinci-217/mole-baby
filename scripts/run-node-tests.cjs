const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tests=['electron','scripts'].flatMap(directory=>fs.readdirSync(path.join(root,directory)).filter(name=>name.endsWith('.node-test.cjs')).sort().map(name=>path.join(directory,name)));
if(!tests.length)throw Error('No Node tests discovered');
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
