'use strict';
const{buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
(async()=>{for(const file of process.argv.slice(2))await buildBlockMap(file,'gzip',file+'.blockmap');})().catch(error=>{console.error(error);process.exitCode=1;});
