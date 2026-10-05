// Local Windows build helper: directory junctions need no symlink privilege.
const fs = require('node:fs');
const path = require('node:path');
const {syncBuiltinESMExports} = require('node:module');
if (process.platform === 'win32') {
  const original = fs.promises.symlink.bind(fs.promises);
  const originalSync = fs.symlinkSync.bind(fs);
  fs.symlinkSync = (target, destination, type) => {
    const absolute = path.resolve(path.dirname(destination), target);
    const stat = fs.statSync(absolute);
    return originalSync(stat.isDirectory() ? absolute : target, destination, stat.isDirectory() ? 'junction' : type);
  };
  fs.promises.symlink = async (target, destination, type) => {
    const absolute = path.resolve(path.dirname(destination), target);
    const stat = await fs.promises.stat(absolute);
    return original(stat.isDirectory() ? absolute : target, destination, stat.isDirectory() ? 'junction' : type);
  };
  syncBuiltinESMExports();
}
