const bodyParser = require('body-parser');
const express = require('express');
const { default: mongoose } = require('mongoose');
const app = express();
const port = 3001;

app.use(bodyParser.json());

mongoose.connect('mongodb://mongo:27017/users')
    .then(() => { console.log('Connected to MongoDB'); })
    .catch(err => { console.error('Failed to connect to MongoDB', err); });

const userSchema = new mongoose.Schema({
    name: String,
    email: String
});

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

app.post('/users', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).send(user);
    }
    catch (err) {
        if (err.code === 11000) {
            res.status(400).send({ error: 'Email must be unique' });
        } else {
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    }
    catch (err) {
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`User Service listening at http://localhost:${port}`);
});
