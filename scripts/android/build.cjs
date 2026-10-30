#!/usr/bin/env node
'use strict';
const path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function run(command,args,cwd=root){cp.execFileSync(command,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});}
run(process.platform==='win32'?'npm.cmd':'npm',['run','build']);
run(process.execPath,[path.join(__dirname,'prepare-assets.cjs')]);
run(process.platform==='win32'?'gradlew.bat':'./gradlew',['assembleDebug','testDebugUnitTest','lintDebug','--no-daemon'],path.join(root,'android'));
