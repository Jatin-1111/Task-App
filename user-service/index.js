const express = require('express');
const { default: mongoose } = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Better body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const mongoUrl = process.env.MONGODB_URL || 'mongodb://mongo:27017/users';

// MongoDB connection with optimized settings
const mongoOptions = {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    bufferCommands: false // Disable mongoose buffering
};

mongoose.connect(mongoUrl, mongoOptions)
    .then(() => { console.log('✅ User Service connected to MongoDB'); })
    .catch(err => { console.error('❌ Failed to connect to MongoDB', err); });

const userSchema = new mongoose.Schema({
    name: String,
    email: String
});

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

app.post('/users', async (req, res) => {
    try {
        console.log('📝 Creating new user:', req.body);
        const start = Date.now();

        const user = new User(req.body);
        await user.save();

        const duration = Date.now() - start;
        console.log(`✅ User created in ${duration}ms`);

        res.status(201).send(user);
    }
    catch (err) {
        console.error('❌ Error creating user:', err);
        if (err.code === 11000) {
            res.status(400).send({ error: 'Email must be unique' });
        } else {
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
});

app.get('/users', async (req, res) => {
    try {
        console.log('📊 Fetching users from database...');
        const start = Date.now();

        // Use lean() for faster queries (returns plain JS objects)
        const users = await User.find().lean().exec();

        const duration = Date.now() - start;
        console.log(`✅ Users fetched in ${duration}ms`);

        res.json(users);
    }
    catch (err) {
        console.error('❌ Error fetching users:', err);
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
        service: 'user-service',
        version: '1.0.0',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime()
    };

    res.status(200).json(healthStatus);
});

// User validation endpoint for other services
app.get('/users/:id/validate', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            res.json({ valid: true, user: { id: user._id, name: user.name, email: user.email } });
        } else {
            res.status(404).json({ valid: false, message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ valid: false, error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`🚀 User Service listening at http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
});
