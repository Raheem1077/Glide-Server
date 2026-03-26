const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname);
    if (!ext) {
      if (file.mimetype.startsWith('image/')) ext = '.jpg';
      else if (file.mimetype.startsWith('application/pdf')) ext = '.pdf';
      else ext = '.bin';
    }
    cb(null, `media-${Date.now()}${ext}`);
  }
});

function checkFileType(file, cb) {
  // Allow images and common document formats
  const filetypes = /jpeg|jpg|png|webp|gif|pdf|doc|docx|xls|xlsx|txt|rtf|csv/;
  const mimetype = /image|application|text/.test(file.mimetype);

  if (mimetype) {
    return cb(null, true);
  } else {
    cb('Error: Images and Documents Only!');
  }
}

const uploadMedia = multer({
  storage: storage,
  limits: { fileSize: 25000000 }, // 25MB limit for docs/images
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = uploadMedia;
