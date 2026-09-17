const fs = require('fs');
const { parse } = require('csv-parse');

exports.parseCsv = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }))
      .on('data', (data) => results.push(data))
      .on('error', (err) => reject(err))
      .on('end', () => resolve(results));
  });
};
