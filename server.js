const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const port = 3001;

// Middleware
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/insulin_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define Log Schema
const logSchema = new mongoose.Schema({
  buttonClickTime: Date,
  notificationSendTime: Date,
  error: String,
});

// Create Log Model
const Log = mongoose.model('Log', logSchema);

// Endpoint to trigger notifications
app.post('/trigger-notifications', async (req, res) => {
  try {
    const buttonClickTime = new Date();
    const notificationSendTime1 = new Date(buttonClickTime.getTime() + 2 * 60 * 60 * 1000);
    const notificationSendTime2 = new Date(buttonClickTime.getTime() + 3 * 60 * 60 * 1000);

    // Simulate sending notifications
    console.log('Notification sent at', notificationSendTime1);
    console.log('Notification sent at', notificationSendTime2);

    // Log the event
    const logEntry = new Log({
      buttonClickTime,
      notificationSendTime: notificationSendTime1,
    });
    await logEntry.save();

    logEntry = new Log({
      buttonClickTime,
      notificationSendTime: notificationSendTime2,
    });
    await logEntry.save();

    res.status(200).send('Notifications triggered and logged');
  } catch (error) {
    console.error('Error triggering notifications:', error);
    res.status(500).send('Error triggering notifications');
  }
});

// Endpoint to retrieve log
app.get('/log', async (req, res) => {
  try {
    const logs = await Log.find({
      buttonClickTime: {
        $gte: new Date(new Date() - 24 * 60 * 60 * 1000),
      },
    }).sort({ buttonClickTime: 1 });

    res.status(200).json(logs);
  } catch (error) {
    console.error('Error retrieving log:', error);
    res.status(500).send('Error retrieving log');
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
