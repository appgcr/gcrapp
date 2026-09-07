const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  lat: { type: String, required: true },
  lng: { type: String, required: true },
  imageUrl: { type: String, required: true },
  attendanceType: { type: String, enum: ['Clock-In', 'Clock-Out'], required: true },
  status: { type: String, enum: ['Verified', 'Pending', 'Rejected'], default: 'Verified' }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
