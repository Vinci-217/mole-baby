/** Find source modules which cannot be reached from the shipped renderer.
 * Keep gameplay save compatibility and authoring/reference assets separate. */
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),seen=new Set();
function visit(file){
 if(!file||seen.has(file)||file.includes('/node_modules/'))return;
 seen.add(file);
 for(const imported of ts.preProcessFile(fs.readFileSync(file,'utf8'),true,true).importedFiles){
  const module=ts.resolveModuleName(imported.fileName,file,{moduleResolution:ts.ModuleResolutionKind.Bundler,resolveJsonModule:true,jsx:ts.JsxEmit.ReactJSX},ts.sys).resolvedModule;
  if(module&&/\.[cm]?tsx?$/.test(module.resolvedFileName))visit(path.resolve(module.resolvedFileName));
 }
}
visit(path.join(root,'src/main.tsx'));
const all=fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(file=>/\.tsx?$/.test(file)&&!file.includes('.test.')&&!file.endsWith('.d.ts'));
const unreferenced=all.filter(file=>!seen.has(path.join(root,'src',file)));
console.log(JSON.stringify({reachableModules:seen.size,unreferenced},null,2));
if(unreferenced.length)process.exitCode=1;
