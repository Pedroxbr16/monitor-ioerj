const mongoose = require('mongoose');

const doerjOccurrenceSchema = new mongoose.Schema({
  editionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoerjEdition', required: true },
  dateKey: { type: String, required: true }, // YYYY-MM-DD
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  day: { type: Number, required: true },

  partLabel: { type: String, required: true },
  partSlug: { type: String, required: true },
  sectionLabel: { type: String, default: '' },
  sectionLabelNormalized: { type: String, default: '' },
  matchedSectionIds: { type: [String], default: [] },

  idMateria: { type: String, default: '' },
  dataPublicacao: { type: String, default: '' }, // DD/MM/YYYY
  pagina: { type: String, default: '' },
  jornal: { type: String, default: '' },
  tipo: { type: String, default: '' },
  resumo: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },

  searchTextNormalized: { type: String, default: '' },
  coletadoEm: { type: Date, default: Date.now }
});

doerjOccurrenceSchema.index({ dateKey: -1 });
doerjOccurrenceSchema.index({ matchedSectionIds: 1, dateKey: -1 });
doerjOccurrenceSchema.index({ sectionLabelNormalized: 1, dateKey: -1 });
doerjOccurrenceSchema.index({ idMateria: 1, dateKey: -1 });
doerjOccurrenceSchema.index({ editionId: 1 });
doerjOccurrenceSchema.index(
  { editionId: 1, idMateria: 1, pagina: 1, sectionLabelNormalized: 1 },
  { unique: true }
);

module.exports = mongoose.model('DoerjOccurrence', doerjOccurrenceSchema);
