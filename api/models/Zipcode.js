const mongoose = require('mongoose');

const zipcodeSchema = new mongoose.Schema({
  zipcode: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Zipcode', zipcodeSchema); 