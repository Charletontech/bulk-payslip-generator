const fs = require('fs');
const path = require('path');

exports.cleanOldFiles = (dirPath, maxAgeMs) => {
  if (!fs.existsSync(dirPath)) return;

  const now = Date.now();
  
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error(`Cleanup: Error reading directory ${dirPath}`, err);
      return;
    }

    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      fs.stat(fullPath, (err, stats) => {
        if (err) {
          console.error(`Cleanup: Error stating file ${fullPath}`, err);
          return;
        }

        const age = now - stats.mtimeMs;
        if (age > maxAgeMs) {
          if (stats.isDirectory()) {
            fs.rm(fullPath, { recursive: true, force: true }, (err) => {
              if (err) console.error(`Cleanup: Error deleting directory ${fullPath}`, err);
            });
          } else {
            fs.unlink(fullPath, (err) => {
              if (err) console.error(`Cleanup: Error deleting file ${fullPath}`, err);
            });
          }
        }
      });
    });
  });
};
