const amqp = require('amqplib');

let channel, connection;

async function connectRabbitMQWithRetry(retries = 10, delay = 3000) {
    while (retries) {
        try {
            connection = await amqp.connect('amqp://rabbitmq');
            channel = await connection.createChannel();
            await channel.assertQueue('task_notifications');
            console.log('Notification Service connected to RabbitMQ');

            // Set up the consumer
            channel.consume('task_notifications', (msg) => {
                if (msg) {
                    const taskData = JSON.parse(msg.content.toString());
                    console.log('Received task notification:', taskData.title);
                    console.log('Full task data:', taskData);

                    // Acknowledge the message
                    channel.ack(msg);
                }
            });

            // Handle connection errors
            connection.on('error', (err) => {
                console.error('RabbitMQ connection error:', err);
            });

            connection.on('close', () => {
                console.log('RabbitMQ connection closed. Attempting to reconnect...');
                setTimeout(() => connectRabbitMQWithRetry(), 5000);
            });

            return;
        } catch (err) {
            console.error('Failed to connect to RabbitMQ, retrying...', err);
            retries--;
            if (retries === 0) {
                console.error('Failed to connect to RabbitMQ after all retries');
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

// Start the connection
connectRabbitMQWithRetry();

// Keep the process alive
console.log('Notification Service starting...');