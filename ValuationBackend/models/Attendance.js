const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  lat: { type: String, required: true },
  lng: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  attendanceType: { type: String, enum: ['Clock-In', 'Clock-Out', 'Location Update'], required: true },
  status: { type: String, enum: ['Verified', 'Pending', 'Rejected', 'Background'], default: 'Verified' },
  address: { type: String, default: '' },
  formattedTime: { type: String, default: '' },
  formattedDate: { type: String, default: '' },
  workDurationHours: { type: Number, default: 0 },
  workDurationFormatted: { type: String, default: '' },
  faceVerified: { type: Boolean, default: false },
  faceMatchScore: { type: Number, default: 0 },
  livenessVerified: { type: Boolean, default: false }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
