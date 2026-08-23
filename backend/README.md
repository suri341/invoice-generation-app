# Jagannath Enterprises - Backend API

Python FastAPI backend for invoice generation system.

## 🏢 Company Details
- **Owner**: K. Krishna
- **Company**: Jagannath Enterprises  
- **Phone**: 8919575870

## 🛠️ Tech Stack
- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **PDF Generation**: ReportLab
- **Validation**: Pydantic
- **Authentication**: JWT (ready for future use)

## 📋 Features
- RESTful API for invoice management
- Customer CRUD operations
- Rice mill parts catalog
- PDF invoice generation
- Tax calculations (GST)
- Search and filtering

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- PostgreSQL 15+

### Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/invoice_db"
export SECRET_KEY="your-secret-key"

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

### API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🐳 Docker

```bash
# Build image
docker build -t invoice-backend .

# Run container
docker run -d \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/invoice_db" \
  --name invoice-backend \
  invoice-backend
```

## 📁 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── database.py          # Database connection
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── api/                 # API routes
│   ├── services/            # Business logic
│   └── utils/               # Utilities (PDF generation)
├── alembic/                 # Database migrations
├── requirements.txt
├── Dockerfile
└── README.md
```

## 🔌 API Endpoints

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer
- `GET /api/customers/{id}` - Get customer
- `PUT /api/customers/{id}` - Update customer
- `DELETE /api/customers/{id}` - Delete customer

### Parts
- `GET /api/parts` - List all parts
- `POST /api/parts` - Create part
- `GET /api/parts/{id}` - Get part
- `PUT /api/parts/{id}` - Update part

### Invoices
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/{id}` - Get invoice
- `GET /api/invoices/{id}/pdf` - Download PDF
- `PUT /api/invoices/{id}` - Update invoice

## 🔐 Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:3000
DEBUG=True
```

## 🧪 Testing

```bash
pytest
```
