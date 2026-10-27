const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{LEGACY_ELECTRON_VERSION,windowsRuntime,supportsWindowsRelease}=require('./windows-runtime.cjs');
test('legacy editions use architecture-specific channels and never modern metadata',()=>{
 for(const arch of ['ia32','x64']){const runtime=windowsRuntime({windowsEdition:'legacy'},arch);assert.equal(runtime.channel,`legacy-${arch}`);assert.equal(runtime.minimumSystem,'Windows 7 SP1');assert.equal(runtime.uninstallerName,'Uninstall 拉姆兼容版.exe');assert.equal(runtime.userDataName,'mole-baby-legacy')}
 assert.equal(windowsRuntime({},'x64').channel,'latest');
 assert.equal(windowsRuntime({},'x64').uninstallerName,'Uninstall 拉姆.exe');
 assert.throws(()=>windowsRuntime({windowsEdition:'legacy'},'arm64'),/Unsupported/);
 assert.throws(()=>windowsRuntime({},'ia32'),/Unsupported/);
 assert.throws(()=>windowsRuntime({windowsEdition:'legcy'},'x64'),/Unknown/);
});
test('minimum supported Windows versions distinguish Win7 SP0/SP1 and Win8 from modern',()=>{
 const legacy={windowsEdition:'legacy'};
 for(const version of ['5.1.2600','6.0.6002','6.1.7600'])assert.equal(supportsWindowsRelease(version,legacy,'ia32'),false,version);
 for(const version of ['6.1.7601','6.2.9200','6.3.9600','10.0.19045','10.0.26100'])assert.equal(supportsWindowsRelease(version,legacy,'x64'),true,version);
 for(const version of ['6.1.7601','6.2.9200','6.3.9600'])assert.equal(supportsWindowsRelease(version,{},'x64'),false,version);
 for(const version of ['10.0.10240','10.0.26100'])assert.equal(supportsWindowsRelease(version,{},'x64'),true,version);
 for(const version of ['',null,'invalid','6','6.1.-1','10.0.invalid','10.0.19045-extra','99999999999999999999.0.0'])assert.equal(supportsWindowsRelease(version,legacy,'x64'),false,String(version));
});
test('legacy build config keeps runtime, installer edition, output and update channel aligned',()=>{
 const file=path.resolve(__dirname,'../electron-builder.legacy.cjs'),previous=process.env.MOLE_LEGACY_ARCH;
 try{for(const arch of ['ia32','x64']){process.env.MOLE_LEGACY_ARCH=arch;delete require.cache[file];const config=require(file);assert.equal(config.electronVersion,LEGACY_ELECTRON_VERSION);assert.equal(config.extraMetadata.windowsEdition,'legacy');assert.equal(config.extraMetadata.name,'mole-baby-legacy');assert.equal(config.appId,'com.molebaby.ramuhouse.legacy');assert.equal(config.directories.output,`release/legacy-${arch}`);assert.equal(config.publish[0].channel,`legacy-${arch}`);assert.equal(config.nsis.include,'electron/installer-legacy.nsh');assert.match(config.nsis.artifactName,/legacy-\$\{arch\}-Setup/);assert.match(config.win.artifactName,/legacy-\$\{arch\}/)}}finally{if(previous===undefined)delete process.env.MOLE_LEGACY_ARCH;else process.env.MOLE_LEGACY_ARCH=previous;delete require.cache[file]}
});
