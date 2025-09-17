const amqp = require('amqplib');
const express = require('express');
const { default: mongoose } = require('mongoose');
require('dotenv').config();

// Express app for HTTP endpoints
const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());

// MongoDB connection for notification history
const mongoUrl = process.env.MONGODB_URL || 'mongodb://mongo:27017/notifications';
mongoose.connect(mongoUrl)
    .then(() => { console.log('✅ Notification Service connected to MongoDB'); })
    .catch(err => { console.error('❌ Failed to connect to MongoDB', err); });

// Notification schema for storing history
const notificationSchema = new mongoose.Schema({
    taskId: String,
    title: String,
    userId: String,
    message: String,
    type: { type: String, default: 'task_created' },
    status: { type: String, default: 'sent' },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

let channel, connection;
const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq';

async function connectRabbitMQWithRetry(retries = 10, delay = 3000) {
    while (retries) {
        try {
            connection = await amqp.connect(rabbitmqUrl);
            channel = await connection.createChannel();
            await channel.assertQueue('task_notifications');
            console.log('✅ Notification Service connected to RabbitMQ');

            // Set up the consumer
            channel.consume('task_notifications', async (msg) => {
                if (msg) {
                    try {
                        const taskData = JSON.parse(msg.content.toString());
                        console.log('📨 Received task notification:', taskData.title);

                        // Save notification to database
                        const notification = new Notification({
                            taskId: taskData.taskId,
                            title: taskData.title,
                            userId: taskData.userId,
                            message: `New task created: ${taskData.title}`,
                            type: 'task_created'
                        });

                        await notification.save();
                        console.log('💾 Notification saved to database');

                        // Here you can add email/SMS sending logic
                        // await sendEmail(taskData);
                        // await sendSMS(taskData);

                        // Acknowledge the message
                        channel.ack(msg);
                    } catch (error) {
                        console.error('❌ Error processing notification:', error);
                        // Reject and requeue the message
                        channel.nack(msg, false, true);
                    }
                }
            });

            // Handle connection errors
            connection.on('error', (err) => {
                console.error('❌ RabbitMQ connection error:', err);
            });

            connection.on('close', () => {
                console.log('🔄 RabbitMQ connection closed. Attempting to reconnect...');
                setTimeout(() => connectRabbitMQWithRetry(), 5000);
            });

            return;
        } catch (err) {
            console.error('❌ Failed to connect to RabbitMQ, retrying...', err);
            retries--;
            if (retries === 0) {
                console.error('💥 Failed to connect to RabbitMQ after all retries');
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

// HTTP Endpoints
app.get('/health', (req, res) => {
    const healthStatus = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'notification-service',
        version: '1.0.0',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        rabbitmq: channel ? 'connected' : 'disconnected',
        uptime: process.uptime()
    };

    res.status(200).json(healthStatus);
});

// Get notifications for a user
app.get('/notifications/user/:userId', async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.params.userId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get all notifications
app.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Create notification manually
app.post('/notifications', async (req, res) => {
    try {
        const { userId, message, type, taskId, title } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        const notification = new Notification({
            taskId: taskId || null,
            title: title || null,
            userId,
            message,
            type: type || 'manual',
            status: 'sent'
        });

        await notification.save();
        res.status(201).json(notification);
    } catch (err) {
        console.error('Error creating notification:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start HTTP server
app.listen(port, () => {
    console.log(`🚀 Notification Service HTTP server listening at http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
});

// Start the RabbitMQ connection
connectRabbitMQWithRetry();

// Keep the process alive
console.log('📢 Notification Service starting...');