exports.sanitizeFilename = (filename) => {
  if (!filename) return 'Unknown';
  // Replace invalid characters with an underscore
  return filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
};
