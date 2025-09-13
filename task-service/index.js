const bodyParser = require('body-parser');
const express = require('express');
const { default: mongoose } = require('mongoose');
const app = express();
const port = 3002;
const amqp = require('amqplib');

app.use(bodyParser.json());

mongoose.connect('mongodb://mongo:27017/tasks')
    .then(() => { console.log('Connected to MongoDB'); })
    .catch(err => { console.error('Failed to connect to MongoDB', err); });

const taskSchema = new mongoose.Schema({
    title: String,
    description: String,
    userId: String,
    createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

let channel, connection;

async function connectRabbitMQWithRetry(retries = 5, delay = 3000) {
    while (retries) {
        try {
            connection = await amqp.connect('amqp://rabbitmq');
            channel = await connection.createChannel();
            await channel.assertQueue('task_notifications');
            console.log('Connected to RabbitMQ');
            return;
        } catch (err) {
            console.error('Failed to connect to RabbitMQ, retrying...', err);
            retries--;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

connectRabbitMQWithRetry();

app.post('/tasks', async (req, res) => {
    const { title, description, userId } = req.body;

    try {
        const task = new Task({ title, description, userId });
        await task.save();

        const message = { taskId: task._id, title, userId };

        if (!channel) {
            return res.status(503).send({ error: 'No channel to RabbitMQ' });
        }

        channel.sendToQueue('task_notifications', Buffer.from(JSON.stringify(message)));

        res.status(201).send(task);
    }
    catch (err) {
        if (err.code === 11000) {
            res.status(400).send({ error: 'Email must be unique' });
        } else {
            res.status(500).send({ error: 'Internal Server Error' });
        }
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

app.listen(port, () => {
    console.log(`Task Service listening at http://localhost:${port}`);
});
