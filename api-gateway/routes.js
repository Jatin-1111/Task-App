const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const router = express.Router();

// Service URLs from environment variables
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:3002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003';

// User Service Routes - Fast and simple proxy
router.use('/users', createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/users': '/users'  // Rewrite /api/users to /users
    },
    timeout: 10000, // Increased timeout for POST requests
    onError: (err, req, res) => {
        console.error(`❌ User Service Error:`, err.message);
        if (!res.headersSent) {
            res.status(503).json({
                error: 'User Service Unavailable',
                message: 'The user service is currently unavailable'
            });
        }
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`🔄 ${req.method} ${req.originalUrl} → User Service`);

        // Fix for POST/PUT requests with body
        if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
            console.log(`� Forwarding body:`, req.body);
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`✅ User Service responded: ${proxyRes.statusCode}`);
    }
}));

// Task Service Routes - Fast and simple proxy
router.use('/tasks', createProxyMiddleware({
    target: TASK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/tasks': '/tasks'  // Rewrite /api/tasks to /tasks
    },
    timeout: 5000, // Reduced timeout
    onError: (err, req, res) => {
        console.error(`❌ Task Service Error:`, err.message);
        if (!res.headersSent) {
            res.status(503).json({
                error: 'Task Service Unavailable',
                message: 'The task service is currently unavailable'
            });
        }
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`🔄 ${req.method} ${req.originalUrl} → Task Service`);

        // Fix for POST/PUT requests with body
        if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`✅ Task Service responded: ${proxyRes.statusCode}`);
    }
}));

// Notification Service Routes - Fast and simple proxy
router.use('/notifications', createProxyMiddleware({
    target: NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/notifications': '/notifications'  // Rewrite /api/notifications to /notifications
    },
    timeout: 5000, // Reduced timeout
    onError: (err, req, res) => {
        console.error(`❌ Notification Service Error:`, err.message);
        if (!res.headersSent) {
            res.status(503).json({
                error: 'Notification Service Unavailable',
                message: 'The notification service is currently unavailable'
            });
        }
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`🔄 ${req.method} ${req.originalUrl} → Notification Service`);

        // Fix for POST/PUT requests with body
        if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`✅ Notification Service responded: ${proxyRes.statusCode}`);
    }
}));

// Health check for all services
router.get('/health/all', async (req, res) => {
    const axios = require('axios');

    const services = [
        { name: 'user-service', url: `${USER_SERVICE_URL}/health` },
        { name: 'task-service', url: `${TASK_SERVICE_URL}/health` },
        { name: 'notification-service', url: `${NOTIFICATION_SERVICE_URL}/health` }
    ];

    const results = await Promise.allSettled(
        services.map(async (service) => {
            try {
                const response = await axios.get(service.url, {
                    timeout: 5000
                });
                return {
                    service: service.name,
                    status: response.status === 200 ? 'healthy' : 'unhealthy',
                    statusCode: response.status,
                    data: response.data
                };
            } catch (error) {
                return {
                    service: service.name,
                    status: 'unhealthy',
                    error: error.message
                };
            }
        })
    );

    const healthStatus = results.map(result => result.value || result.reason);
    const allHealthy = healthStatus.every(status => status.status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
        gateway: 'healthy',
        services: healthStatus,
        timestamp: new Date().toISOString()
    });
});// Service discovery endpoint
router.get('/services', (req, res) => {
    res.json({
        services: {
            'user-service': {
                url: USER_SERVICE_URL,
                endpoints: ['/users', '/users/:id', '/users/:id/validate']
            },
            'task-service': {
                url: TASK_SERVICE_URL,
                endpoints: ['/tasks', '/tasks/:id']
            },
            'notification-service': {
                url: NOTIFICATION_SERVICE_URL,
                endpoints: ['/notifications', '/notifications/user/:userId']
            }
        },
        gateway: {
            version: '1.0.0',
            uptime: process.uptime()
        }
    });
});

// Debug endpoint to test direct service connectivity
router.get('/debug/connectivity', async (req, res) => {
    const axios = require('axios');

    const tests = [
        { service: 'user-service', url: `${USER_SERVICE_URL}/` },
        { service: 'task-service', url: `${TASK_SERVICE_URL}/` },
        { service: 'notification-service', url: `${NOTIFICATION_SERVICE_URL}/health` }
    ];

    const results = await Promise.allSettled(
        tests.map(async (test) => {
            try {
                const response = await axios.get(test.url, { timeout: 3000 });
                return {
                    service: test.service,
                    url: test.url,
                    status: 'reachable',
                    statusCode: response.status,
                    response: response.data
                };
            } catch (error) {
                return {
                    service: test.service,
                    url: test.url,
                    status: 'unreachable',
                    error: error.message,
                    code: error.code
                };
            }
        })
    );

    res.json({
        debug: 'Service Connectivity Test',
        results: results.map(r => r.value || r.reason),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;