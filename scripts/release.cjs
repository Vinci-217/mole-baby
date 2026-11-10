#!/usr/bin/env node
'use strict';

/**
 * Repeatable release gate. It validates the checked-in tree, runs the same
 * shared checks used by CI, and optionally pushes the current commit to the
 * release branch. GitHub Actions remains responsible for building, signing,
 * publishing and generating the actual Release.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));

function usage() {
  console.log(`用法：
  npm run release -- --check        检查版本、工作树、类型、测试与构建
  npm run release -- --push         检查通过后推送 release/v<版本> 分支
  npm run release -- --allow-dirty  允许本地检查时保留未提交改动（不能与 --push 一起用）
  npm run release -- --help`);
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}

const check = args.has('--check') || args.has('--push') || args.has('--allow-dirty') || args.size === 0;
const push = args.has('--push');
const allowDirty = args.has('--allow-dirty');
const known = new Set(['--check', '--push', '--allow-dirty']);
for (const arg of args) {
  if (!known.has(arg)) {
    console.error(`未知参数：${arg}`);
    usage();
    process.exit(2);
  }
}
if (!check) {
  usage();
  process.exit(2);
}
if (push && allowDirty) {
  console.error('--push 不能和 --allow-dirty 一起使用。');
  process.exit(2);
}

function run(command, commandArgs, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label}失败（退出码 ${result.status ?? 'unknown'}）。`);
}

function output(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} 执行失败。`);
  return result.stdout.trim();
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error(`版本号必须是稳定三段式：${pkg.version}`);
  const branch = output('git', ['branch', '--show-current']);
  const status = output('git', ['status', '--porcelain']);
  if (status && !allowDirty) {
    throw new Error('工作树有未提交改动；提交后再运行发版检查，或仅本地使用 --allow-dirty。');
  }
  if (status) console.warn('⚠ --allow-dirty 已启用：本次只做本地检查，不可推送。');
  run('git', ['diff', '--check'], '检查空白与冲突标记');
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '-b', '--pretty', 'false'], 'TypeScript 类型检查');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['test'], '单元与 Node 回归测试');
  run(npm, ['run', 'build'], '生产构建');
  run('node', ['scripts/xapk-package.node-test.cjs'], 'Android XAPK 打包契约测试');
  console.log(`\n检查通过：v${pkg.version}（当前分支 ${branch || '(detached)'}）。`);
  if (!push) {
    console.log('未推送。用户确认后运行：npm run release -- --push');
    return;
  }
  const target = `release/v${pkg.version}`;
  run('git', ['push', 'origin', `HEAD:refs/heads/${target}`], `推送 ${target}`);
  console.log(`已推送 ${target}。后续由 GitHub Actions 完成多平台构建、校验和 Release。`);
}

try {
  main();
} catch (error) {
  console.error(`\n发版流程已停止：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
