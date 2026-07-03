const cloudinaryService = require('../services/cloudinaryService');

// Generic media upload. The app uploads files here first (while adding/editing a
// property) and then includes the returned descriptors in the property payload.
// Field name: 'files' (one or many). ?type=image|document decides how Cloudinary
// stores them — images as pictures, documents as raw files so they download intact.
exports.uploadMedia = async (req, res) => {
  try {
    if (!cloudinaryService.isConfigured()) {
      return res.status(503).json({
        error: 'Image uploads are not configured. Set CLOUDINARY_* keys in the backend .env.',
      });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files were provided.' });
    }

    const type = req.query.type === 'document' ? 'document' : 'image';
    const resourceType = type === 'document' ? 'raw' : 'image';

    const media = await Promise.all(
      files.map(async (file) => {
        const uploaded = await cloudinaryService.uploadBuffer(file.buffer, {
          resourceType,
          filename: file.originalname,
        });
        return {
          ...uploaded,
          name: file.originalname,
          mimeType: file.mimetype,
        };
      })
    );

    res.status(201).json({ message: 'Uploaded.', media });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(502).json({ error: 'Upload failed. Please try again.' });
  }
};
