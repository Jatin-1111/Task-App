# Task App - Microservices with API Gateway 🚀

A modern microservices architecture with API Gateway for task management application.

## 🏗️ Architecture

```
Client → API Gateway (Port 3000) → Microservices
                ↓
         [User, Task, Notification Services]
                ↓
         [MongoDB + RabbitMQ]
```

## 🔧 Services

| Service                  | Port        | Purpose                              | Database         |
| ------------------------ | ----------- | ------------------------------------ | ---------------- |
| **API Gateway**          | 3000        | Single entry point, routing, logging | -                |
| **User Service**         | 3001        | User management & authentication     | users_db         |
| **Task Service**         | 3002        | Task CRUD, user validation           | tasks_db         |
| **Notification Service** | 3003        | Notifications & history              | notifications_db |
| **MongoDB**              | 27017       | Database                             | -                |
| **RabbitMQ**             | 5672, 15672 | Message broker                       | -                |

## 🚀 Quick Start

### 1. Start All Services

```bash
docker-compose up --build
```

### 2. Check Health Status

```bash
# Gateway health
curl http://localhost:3000/health

# All services health
curl http://localhost:3000/api/health/all
```

## 📡 API Endpoints

### Through API Gateway (Recommended)

#### Users

```bash
# Create user
POST http://localhost:3000/api/users
{
  "name": "John Doe",
  "email": "john@example.com"
}

# Get all users
GET http://localhost:3000/api/users

# Validate user (internal)
GET http://localhost:3000/api/users/:id/validate
```

#### Tasks

```bash
# Create task (validates user first)
POST http://localhost:3000/api/tasks
{
  "title": "Complete project",
  "description": "Finish the microservices setup",
  "userId": "USER_ID_HERE"
}

# Get all tasks
GET http://localhost:3000/api/tasks

# Get tasks by user
GET http://localhost:3000/api/tasks/user/:userId
```

#### Notifications

```bash
# Get all notifications
GET http://localhost:3000/api/notifications

# Get user notifications
GET http://localhost:3000/api/notifications/user/:userId
```

## 🔄 Inter-Service Communication

### HTTP Communication (Synchronous)

- **Task Service** → **User Service**: Validates user before creating tasks
- Through internal Docker network using service names

### Message-Based Communication (Asynchronous)

- **Task Service** → **Notification Service**: Via RabbitMQ
- Queue: `task_notifications`

## 📊 Monitoring & Health Checks

### Individual Service Health

```bash
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Task Service
curl http://localhost:3003/health  # Notification Service
```

### Gateway Features

- **Request Logging**: All requests logged with unique IDs
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Error Handling**: Comprehensive error responses
- **CORS**: Configured for development
- **Security Headers**: Helmet.js for security

## 🛠️ Development

### Environment Variables

Each service has its own `.env` file:

- `api-gateway/.env`
- `user-service/.env`
- `task-service/.env`
- `notification-service/.env`

### Testing Flow

1. **Create a User**:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}'
```

2. **Create a Task** (use user ID from step 1):

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Task", "description": "Testing inter-service communication", "userId": "PASTE_USER_ID_HERE"}'
```

3. **Check Notifications**:

```bash
curl http://localhost:3000/api/notifications
```

## 🔍 Features Implemented

✅ **API Gateway with Express.js**

- Request routing to appropriate services
- Request/response logging
- Error handling middleware
- Rate limiting
- CORS configuration

✅ **Inter-Service Communication**

- HTTP calls for user validation
- RabbitMQ for async notifications
- Service discovery via environment variables

✅ **Separate Databases**

- Each service has its own database
- Environment-based configuration

✅ **Health Monitoring**

- Individual service health endpoints
- Gateway health aggregation
- Service availability checking

✅ **Improved Error Handling**

- Structured error responses
- Request ID tracking
- Timeout management

## 🐛 Troubleshooting

### Service Not Starting

1. Check Docker logs: `docker-compose logs [service-name]`
2. Verify environment variables in `.env` files
3. Ensure ports are not in use

### Connection Issues

1. Check if all services are healthy: `curl http://localhost:3000/api/health/all`
2. Verify internal network connectivity
3. Check RabbitMQ management UI: http://localhost:15672 (guest/guest)

### Database Issues

1. Check MongoDB connection: `docker-compose logs mongo`
2. Verify database URLs in service logs
3. Check if databases are created automatically

## 📈 Next Steps

- [ ] Add JWT authentication
- [ ] Implement API versioning
- [ ] Add request caching
- [ ] Set up centralized logging (ELK stack)
- [ ] Add metrics collection (Prometheus)
- [ ] Implement circuit breakers
- [ ] Add integration tests

## 🔗 External Access

- **API Gateway**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672
- **MongoDB**: localhost:27017

**Use API Gateway for all external requests!**
Direct service access should only be used for debugging.
