const mongoose = require('mongoose');

const doerjEditionSchema = new mongoose.Schema({
  dateKey: { type: String, required: true }, // YYYY-MM-DD
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  day: { type: Number, required: true },

  partLabel: { type: String, required: true },
  partSlug: { type: String, required: true },

  selectionUrl: { type: String, default: '' },
  viewerUrl: { type: String, default: '' },
  pdfUrl: { type: String, default: '' },
  pdfFingerprint: { type: String, default: '' },

  localPdfPath: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSizeBytes: { type: Number, default: 0 },
  totalPages: { type: Number, default: 0 },

  sectionRanges: {
    type: [{
      label: { type: String, default: '' },
      page: { type: Number, default: 0 },
      startPage: { type: Number, default: 0 },
      endPage: { type: Number, default: 0 }
    }],
    default: []
  },

  status: { type: String, enum: ['ok', 'empty', 'error'], default: 'ok' },
  source: { type: String, default: 'manual' },
  downloadedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

doerjEditionSchema.index({ dateKey: -1 });
doerjEditionSchema.index({ year: 1, month: 1, day: 1 });
doerjEditionSchema.index({ dateKey: 1, partSlug: 1 }, { unique: true });

module.exports = mongoose.model('DoerjEdition', doerjEditionSchema);
