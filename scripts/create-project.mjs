import path from 'node:path';
import { cp, lstat, mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const templateIndex=args.indexOf('--template');
const template=templateIndex===-1?'starter':args[templateIndex+1];
if(!['starter','focus','motion'].includes(template))throw Error('--template must be starter, focus or motion');

if (args.includes('--help')) {
  console.log('Usage: node scripts/create-project.mjs --out <new-directory> [--template starter|focus|motion]');
  process.exit(0);
}

if (outIndex === -1 || !args[outIndex + 1] || args[outIndex + 1].startsWith('--')) {
  throw Error('Usage: node scripts/create-project.mjs --out <new-directory> [--template starter|focus|motion]');
}

const starter = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/starter');
const target = path.resolve(args[outIndex + 1]);
const relativeTarget = path.relative(starter, target);
if (
  target === starter ||
  (relativeTarget && !relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget))
) {
  throw Error('The project target must be outside assets/starter.');
}

let starterInfo;
try {
  starterInfo = await stat(starter);
} catch (error) {
  if (error?.code === 'ENOENT') {
    throw Error(`Starter directory not found: ${starter}`);
  }
  throw error;
}
if (!starterInfo.isDirectory()) throw Error(`Starter path is not a directory: ${starter}`);

let targetExists = false;
try {
  const targetInfo = await lstat(target);
  targetExists = true;
  if (!targetInfo.isDirectory()) {
    throw Error(`Refusing to use existing non-directory target: ${target}`);
  }
  const entries = await readdir(target);
  if (entries.length > 0) {
    throw Error(`Refusing to copy into non-empty target: ${target}`);
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (!targetExists) await mkdir(target, { recursive: true });
// Node 22 rejects an existing destination directory with errorOnExist, even
// when empty. Copy its children while preserving per-file no-clobber checks.
const focus=path.resolve(starter,template==='motion'?'../motion-demo':'../focus-demo');
const focusNames=template!=='starter'?await readdir(focus):[];
for (const name of await readdir(starter)) {
  if(focusNames.includes(name))continue;
  await cp(path.join(starter, name), path.join(target, name), {
    recursive: true, force: false, errorOnExist: true,
  });
}
for(const name of focusNames){
 await cp(path.join(focus,name),path.join(target,name),{recursive:true,force:false,errorOnExist:true});
}
console.log(target);
