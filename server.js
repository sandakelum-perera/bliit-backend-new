const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/bliit', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const router = require('./router');
app.use(router);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});