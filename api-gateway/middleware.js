const crypto = require('crypto');

// Generate unique request ID for tracking
const requestId = (req, res, next) => {
    req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request
    console.log(`📥 [${req.requestId}] ${req.method} ${req.originalUrl} - ${req.ip}`);

    // Log request body for POST/PUT requests (but hide sensitive data)
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        const logBody = { ...req.body };
        // Hide sensitive fields
        ['password', 'token', 'secret'].forEach(field => {
            if (logBody[field]) logBody[field] = '[HIDDEN]';
        });
        console.log(`📋 [${req.requestId}] Request Body:`, JSON.stringify(logBody));
    }

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - start;
        console.log(`📤 [${req.requestId}] ${res.statusCode} - ${duration}ms`);
        originalEnd.apply(this, args);
    };

    next();
};

// Global error handler
const errorHandler = (err, req, res, next) => {
    // Log error
    console.error(`🚨 [${req.requestId || 'unknown'}] Error:`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Default error response
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        message = 'Service Unavailable';
    }

    // Send error response
    res.status(statusCode).json({
        error: {
            message,
            code: err.code || 'UNKNOWN_ERROR',
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                details: err.details
            })
        }
    });
};

// Authentication middleware (for future use)
const authenticate = (req, res, next) => {
    // TODO: Implement JWT verification
    // For now, just pass through
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please provide a valid token'
        });
    }

    // Add user info to request (mock for now)
    req.user = { id: 'user123', email: 'user@example.com' };
    next();
};

// Service availability checker
const checkServiceHealth = (serviceName, serviceUrl) => {
    return async (req, res, next) => {
        try {
            // Simple health check - you can make this more sophisticated
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

            const response = await fetch(`${serviceUrl}/health`, {
                signal: controller.signal,
                method: 'GET'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`${serviceName} is not healthy`);
            }

            next();
        } catch (error) {
            console.error(`❌ Health check failed for ${serviceName}:`, error.message);

            res.status(503).json({
                error: 'Service Unavailable',
                message: `${serviceName} is currently unavailable`,
                service: serviceName,
                timestamp: new Date().toISOString()
            });
        }
    };
};

// Validate request payload
const validateRequest = (schema) => {
    return (req, res, next) => {
        // Simple validation - you can use Joi or other validation libraries
        if (schema.required) {
            const missing = schema.required.filter(field => !req.body[field]);
            if (missing.length > 0) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `Missing required fields: ${missing.join(', ')}`,
                    missing
                });
            }
        }
        next();
    };
};

module.exports = {
    requestId,
    requestLogger,
    errorHandler,
    authenticate,
    checkServiceHealth,
    validateRequest
};