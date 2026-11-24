const fs=require('node:fs'),sharp=require('sharp');
(async()=>{for(const job of JSON.parse(fs.readFileSync(0,'utf8'))){if(fs.existsSync(job.destination))continue;await sharp(job.source).extract(job.rect).png().toFile(job.destination)}})().catch(error=>{console.error(error);process.exitCode=1});
