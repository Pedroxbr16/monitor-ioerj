const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  keywordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Keyword', required: true },
  keywordText: { type: String, required: true },
  channel: { type: String, enum: ['email', 'whatsapp'], required: true },
  occurrence: {
    idMateria: String,
    dataPublicacao: String,
    pagina: String,
    jornal: String,
    tipo: String,
    resumo: String
  },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
