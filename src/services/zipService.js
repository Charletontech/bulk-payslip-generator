const fs = require('fs');

exports.createZip = async (sourceDir, outputPath) => {
  const archiverModule = await import('archiver');
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = new archiverModule.ZipArchive({
      zlib: { level: 9 } // maximum compression
    });

    output.on('close', () => {
      resolve(archive.pointer());
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn(err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // append files from a directory, putting them at the root of archive
    archive.directory(sourceDir, false);

    archive.finalize();
  });
};
