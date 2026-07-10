const cloudinaryService = require('../services/cloudinaryService');

// Mimetypes we accept from the public (unauthenticated) form uploader. Images
// for photos; the rest are treated as raw documents by Cloudinary.
const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|heic|heif)$/i;
const DOC_MIME =
  /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|text\/plain)$/i;

// POST /api/public/forms/:publicId/upload — unauthenticated media upload for a
// public form submitter. Streams files to Cloudinary and returns the same media
// descriptors the submit step will echo back under the field's key. Never trusts
// the client for anything but the bytes: the form must exist + be active, and
// mimetypes are validated. Field name: 'files'. ?type=image|document.
exports.uploadPublicMedia = async (req, res) => {
  try {
    // The activeForm middleware already resolved (and checked) the form, before
    // multer buffered a single byte.
    if (!cloudinaryService.isConfigured()) {
      return res.status(503).json({ error: 'Uploads are not available right now.' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files were provided.' });
    }

    const type = req.query.type === 'document' ? 'document' : 'image';
    const allow = type === 'document' ? DOC_MIME : IMAGE_MIME;
    const bad = files.find((f) => !allow.test(f.mimetype));
    if (bad) {
      return res.status(400).json({
        error:
          type === 'document'
            ? 'Only PDF, Word, Excel or text documents are allowed.'
            : 'Only image files (JPG, PNG, WEBP, GIF) are allowed.',
      });
    }

    const resourceType = type === 'document' ? 'raw' : 'image';
    const media = await Promise.all(
      files.map(async (file) => {
        const uploaded = await cloudinaryService.uploadBuffer(file.buffer, {
          resourceType,
          filename: file.originalname,
          folder: `${cloudinaryService.FOLDER}/forms`,
        });
        return { ...uploaded, name: file.originalname, mimeType: file.mimetype };
      })
    );

    res.status(201).json({ message: 'Uploaded.', media });
  } catch (error) {
    console.error('Public upload error:', error);
    res.status(502).json({ error: 'Upload failed. Please try again.' });
  }
};
