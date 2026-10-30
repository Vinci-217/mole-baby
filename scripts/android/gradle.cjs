'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'..','.cache','mole-android');
function environment(){
 const env={...process.env};
 if(!env.JAVA_HOME){const directory=path.join(cache,'jdk');if(fs.existsSync(directory))for(const name of fs.readdirSync(directory).sort().reverse()){const jdk=path.join(directory,name);if(fs.existsSync(path.join(jdk,'bin',process.platform==='win32'?'javac.exe':'javac'))){env.JAVA_HOME=jdk;break;}}}
 if(!env.ANDROID_HOME){if(env.ANDROID_SDK_ROOT)env.ANDROID_HOME=env.ANDROID_SDK_ROOT;else if(fs.existsSync(path.join(cache,'sdk','platforms')))env.ANDROID_HOME=path.join(cache,'sdk');}
 const proxyUrl=env.HTTPS_PROXY||env.HTTP_PROXY;
 if(proxyUrl){const proxy=new URL(proxyUrl);let options=env.GRADLE_OPTS||'';
  if(!/^[a-zA-Z0-9.:[\]-]+$/.test(proxy.hostname))throw Error('代理主机名无效，请检查环境网络配置。');
  for(const scheme of ['http','https'])if(!options.includes(`-D${scheme}.proxyHost=`))options+=` -D${scheme}.proxyHost=${proxy.hostname} -D${scheme}.proxyPort=${proxy.port||(proxy.protocol==='https:'?'443':'80')}`;
  // Use the platform's trusted CA set with downloaded JDKs. TLS verification
  // remains enabled; no proxy credentials are copied to command-line options.
  if(process.platform==='linux'&&fs.existsSync('/etc/ssl/certs/java/cacerts')&&!options.includes('-Djavax.net.ssl.trustStore='))options+=' -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts';
  env.GRADLE_OPTS=options.trim();
 }
 return env;
}
function runGradle(args){return cp.execFileSync(process.platform==='win32'?'gradlew.bat':'./gradlew',args,{cwd:path.join(root,'android'),env:environment(),stdio:'inherit',shell:process.platform==='win32'});}
if(require.main===module)try{runGradle(process.argv.slice(2));}catch(error){process.exitCode=typeof error.status==='number'?error.status:1;}
module.exports={environment,runGradle};
