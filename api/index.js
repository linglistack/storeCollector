const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');
const Zipcode = require('./models/Zipcode');

const app = express();

app.use(cors());
app.use(express.json());


// const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
// const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com/v1';



// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});




// // Import routes
// const searchStoresRouter = require('./searchStores');

// // Use routes
// app.use('/api/search-stores', searchStoresRouter);

// Basic route
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the MERN API' });
});

// Add this after your existing basic route
app.post('/api/zipcodes', async (req, res) => {
  try {
    const { zipcode } = req.body;
    const newZipcode = new Zipcode({ zipcode });
    await newZipcode.save();
    res.status(201).json(newZipcode);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all zipcodes
app.get('/api/zipcodes', async (req, res) => {
  try {
    const zipcodes = await Zipcode.find().sort({ createdAt: -1 });
    res.json(zipcodes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(5000, () => {
    console.log('Server is running on port 5000');
  });
}

// For Vercel serverless deployment
module.exports = app; 