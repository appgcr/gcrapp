const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  // Required for Clock-In / Clock-Out (checked in routes/attendance.js); empty for "Location Off"
  lat: { type: String, default: '' },
  lng: { type: String, default: '' },
  accuracy: { type: Number, default: null },     // metres, from the phone's GPS
  imageUrl: { type: String, default: '' },
  attendanceType: { type: String, enum: ['Clock-In', 'Clock-Out', 'Location Update', 'Location Off', 'Location On'], required: true },
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

attendanceSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
