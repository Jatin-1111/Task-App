const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const routes = require('./routes');
const middleware = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ?
        ['https://yourdomain.com'] :
        ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
    credentials: true
}));

// Rate limiting - more lenient for development
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Increased limit for development
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' // Skip rate limiting for health checks
});
app.use(limiter);

// Logging middleware - simplified for performance
app.use((req, res, next) => {
    console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// Body parsing middleware
app.use(express.json({ limit: '1mb' })); // Reduced limit for performance
app.use(express.urlencoded({ extended: true }));

// Simple request ID middleware
app.use((req, res, next) => {
    req.requestId = Date.now().toString();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        version: '1.0.0'
    });
});

// API routes
app.use('/api', routes);

// Default route
app.get('/', (req, res) => {
    res.json({
        message: 'Task App API Gateway',
        version: '1.0.0',
        endpoints: {
            users: '/api/users',
            tasks: '/api/tasks',
            notifications: '/api/notifications',
            health: '/health'
        }
    });
});

// Global error handler
app.use(middleware.errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

module.exports = app;