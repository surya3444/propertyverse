const multer = require('multer');

// Keep audio in memory so we can stream the buffer straight to Gemini
// without ever touching disk. Cap size to protect the server.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

module.exports = upload;
