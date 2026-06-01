# Inventory & Order Management System

A full-stack Inventory & Order Management System for managing products, customers, orders, and stock movement.

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy, Pydantic
- Frontend: React, Vite
- Database: PostgreSQL
- Containerization: Docker and Docker Compose
- Frontend serving: Nginx container

## Features

- Product CRUD with unique SKU validation
- Customer create/list/delete with unique email validation
- Order creation with one or more product lines
- Automatic backend total calculation
- Inventory validation before order creation
- Automatic stock reduction after successful order creation
- Order cancellation with stock restoration
- Dashboard summary for products, customers, orders, and low stock products
- Responsive React interface with form validation and API error messages

## Project Layout

```text
backend/              FastAPI service
  app/                API source code
  Dockerfile          Backend production image
frontend/             React app
  src/                Frontend source code
  Dockerfile          Frontend production image
  nginx.conf          Static SPA server config
docker-compose.yml    Frontend, backend, and PostgreSQL services
.env.example          Example environment configuration
```

## Local Setup With Docker

Create a local environment file from the example.

```bash
cp .env.example .env
```

Start all services.

```bash
docker compose up --build
```

Open the application.

```text
Frontend: http://localhost:8080
Backend API: http://localhost:8000
Swagger Docs: http://localhost:8000/docs
PostgreSQL: localhost:5432
```

Stop services.

```bash
docker compose down
```

Remove database volume if you want a fresh database.

```bash
docker compose down -v
```

## Environment Variables

The Compose file reads variables from `.env`. Do not commit real credentials.

```text
POSTGRES_USER=inventory_user
POSTGRES_PASSWORD=inventory_password
POSTGRES_DB=inventory_db
DATABASE_URL=postgresql+psycopg://inventory_user:inventory_password@db:5432/inventory_db
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:8080
VITE_API_BASE_URL=http://localhost:8000
```

For deployed environments, set `DATABASE_URL` to the hosted PostgreSQL connection string and set `BACKEND_CORS_ORIGINS` to the deployed frontend URL.

## Backend API

Products:

```text
POST   /products
GET    /products
GET    /products/{id}
PUT    /products/{id}
DELETE /products/{id}
```

Customers:

```text
POST   /customers
GET    /customers
GET    /customers/{id}
DELETE /customers/{id}
```

Orders:

```text
POST   /orders
GET    /orders
GET    /orders/{id}
DELETE /orders/{id}
```

Dashboard:

```text
GET /dashboard/summary
```

## Business Rules

- Product SKUs are normalized to uppercase and must be unique.
- Customer emails are normalized to lowercase and must be unique.
- Product price must be greater than zero.
- Product stock cannot be negative.
- Order quantities must be greater than zero.
- Orders are rejected with `409 Conflict` when stock is insufficient.
- Order totals are calculated by the backend from current product prices.
- Product stock is reduced in the same transaction that creates the order.
- Product rows are locked while creating or cancelling orders to reduce overselling risk.

## Manual Backend Run

Install backend dependencies.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set `DATABASE_URL` and run the API.

```bash
uvicorn app.main:app --reload
```

## Manual Frontend Run

Install frontend dependencies and run Vite.

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` to the backend URL when the backend is not running on `http://localhost:8000`.

## Docker Image Build

Build the backend image for Docker Hub.

```bash
docker build -t <dockerhub-username>/inventory-api:latest ./backend
docker push <dockerhub-username>/inventory-api:latest
```

Build the frontend image locally.

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:8000 -t inventory-frontend:latest ./frontend
```

## Deployment Guide

Backend on Render:

1. Create a PostgreSQL database on Render.
2. Create a Web Service from this repository.
3. Use the included `render.yaml` blueprint or Docker deployment with `backend/Dockerfile`.
4. Set `DATABASE_URL` to the Render PostgreSQL internal connection string.
5. Set `BACKEND_CORS_ORIGINS` to the deployed frontend URL.
6. Confirm `https://your-backend-url/health` returns `{"status":"ok"}`.

Frontend on Vercel:

1. Import this repository into Vercel.
2. Set the project root to `frontend`.
3. Use `npm run build` as the build command.
4. Use `dist` as the output directory.
5. Set `VITE_API_BASE_URL` to the deployed backend URL.
6. Redeploy after the backend URL is available.

## Submission Checklist

Fill these in after publishing and deploying.

```text
GitHub repository: <repository-url>
Backend Docker Hub image: <dockerhub-image-url>
Live frontend URL: <frontend-url>
Live backend API URL: <backend-url>
```
