const bodyParser = require('body-parser');
const express = require('express');
const { default: mongoose } = require('mongoose');
const amqp = require('amqplib');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

app.use(bodyParser.json());

const mongoUrl = process.env.MONGODB_URL || 'mongodb://mongo:27017/tasks';
mongoose.connect(mongoUrl)
    .then(() => { console.log('✅ Task Service connected to MongoDB'); })
    .catch(err => { console.error('❌ Failed to connect to MongoDB', err); });

const taskSchema = new mongoose.Schema({
    title: String,
    description: String,
    userId: String,
    createdAt: { type: Date, default: Date.now }
});

// Database indexes for optimized queries
taskSchema.index({ userId: 1 }); // For finding tasks by user
taskSchema.index({ createdAt: -1 }); // For sorting by creation date
taskSchema.index({ userId: 1, createdAt: -1 }); // Compound index for user tasks sorted by date

const Task = mongoose.model('Task', taskSchema);

let channel, connection;
const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';

async function connectRabbitMQWithRetry(retries = 5, delay = 3000) {
    while (retries) {
        try {
            connection = await amqp.connect(rabbitmqUrl);
            channel = await connection.createChannel();
            await channel.assertQueue('task_notifications');
            console.log('✅ Task Service connected to RabbitMQ');
            return;
        } catch (err) {
            console.error('❌ Failed to connect to RabbitMQ, retrying...', err);
            retries--;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

connectRabbitMQWithRetry();

app.post('/tasks', async (req, res) => {
    const { title, description, userId } = req.body;

    try {
        // Validate user exists by calling User Service
        try {
            const userResponse = await axios.get(`${userServiceUrl}/users/${userId}/validate`, {
                timeout: 5000
            });

            if (!userResponse.data.valid) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }
        } catch (userError) {
            console.error('❌ Failed to validate user:', userError.message);
            return res.status(400).json({ error: 'Could not validate user' });
        }

        const task = new Task({ title, description, userId });
        await task.save();

        const message = { taskId: task._id, title, userId };

        if (!channel) {
            console.error('❌ No RabbitMQ channel available');
            return res.status(503).send({ error: 'No channel to RabbitMQ' });
        }

        channel.sendToQueue('task_notifications', Buffer.from(JSON.stringify(message)));
        console.log('📤 Task notification sent to queue');

        res.status(201).send(task);
    }
    catch (err) {
        console.error('❌ Error creating task:', err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/tasks', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    }
    catch (err) {
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthStatus = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'task-service',
        version: '1.0.0',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        rabbitmq: channel ? 'connected' : 'disconnected',
        uptime: process.uptime()
    };

    res.status(200).json(healthStatus);
});

// Get tasks by user ID
app.get('/tasks/user/:userId', async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.params.userId });
        res.json(tasks);
    } catch (err) {
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Task Service listening at http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
});
