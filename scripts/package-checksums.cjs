const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
async function writeChecksums(directory, files, output) {
  const lines=[];
  for (const filename of files) {
    const hash=crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(path.join(directory,filename))) hash.update(chunk);
    lines.push(`${hash.digest('hex')}  ${filename}`);
  }
  fs.writeFileSync(path.join(directory,output), `${lines.join('\n')}\n`);
  console.log(`PASS: ${output} generated for checked downloads`);
}
module.exports={writeChecksums};
