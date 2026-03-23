const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '', trim: true },
  sections: { type: [String], default: [] },
  emailEnabled: { type: Boolean, default: true },
  whatsappEnabled: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  seenIds: { type: [String], default: [] },
  firstScanDone: { type: Boolean, default: false },
  armedFromAt: { type: Date, default: Date.now },
  lastChecked: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Keyword', keywordSchema);
