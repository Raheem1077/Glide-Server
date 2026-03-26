const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Some audio files from expo might not have an extension, default to .m4a if missing
    let ext = path.extname(file.originalname);
    if (!ext) ext = '.m4a';
    cb(null, `audio-${Date.now()}${ext}`);
  }
});

function checkFileType(file, cb) {
  // Allow common mobile audio formats
  const filetypes = /mp3|m4a|mp4|wav|webm|aac|ogg|3gp|amr/;
  const mimetype = /audio|video|application\/octet-stream/.test(file.mimetype);

  if (mimetype) {
    return cb(null, true);
  } else {
    cb('Error: Audio Only!');
  }
}

const uploadAudio = multer({
  storage: storage,
  limits: { fileSize: 15000000 }, // 15MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = uploadAudio;
