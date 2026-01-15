# AWS Deployment Guide for BizPilot

This guide covers deploying BizPilot to AWS using various services.

## Architecture Options

### Option 1: AWS App Runner (Recommended for simplicity)
- **Backend**: App Runner with ECR image
- **Frontend**: App Runner with ECR image
- **Database**: RDS PostgreSQL
- **Cache**: ElastiCache Redis

### Option 2: ECS Fargate (Recommended for production)
- **Backend**: ECS Fargate service
- **Frontend**: ECS Fargate service or S3 + CloudFront
- **Database**: RDS PostgreSQL
- **Cache**: ElastiCache Redis
- **Load Balancer**: Application Load Balancer

### Option 3: Elastic Beanstalk
- **Backend**: Elastic Beanstalk Docker environment
- **Frontend**: Elastic Beanstalk or S3 + CloudFront
- **Database**: RDS PostgreSQL

---

## Prerequisites

1. AWS CLI installed and configured
2. Docker installed locally
3. An AWS account with appropriate permissions

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
```

---

## Option 1: AWS App Runner Deployment

### Step 1: Create ECR Repositories

```bash
# Set variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create ECR repositories
aws ecr create-repository --repository-name bizpilot-api --region $AWS_REGION
aws ecr create-repository --repository-name bizpilot-web --region $AWS_REGION

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

### Step 2: Build and Push Docker Images

```bash
# Build and push backend
docker build -f backend/Dockerfile -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bizpilot-api:latest .
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bizpilot-api:latest

# Build and push frontend
docker build -f frontend/Dockerfile -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bizpilot-web:latest .
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bizpilot-web:latest
```

### Step 3: Create RDS PostgreSQL Database

```bash
# First, find your VPC subnets (use at least 2 in different AZs)
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,AvailabilityZone,VpcId]' --output table

# Create a DB subnet group (replace with your actual subnet IDs from the output above)
aws rds create-db-subnet-group \
    --db-subnet-group-name bizpilot-db-subnet \
    --db-subnet-group-description "BizPilot DB Subnet Group" \
    --subnet-ids subnet-abc123 subnet-def456

# Create the RDS instance with AWS-managed password (recommended)
# This stores the password in Secrets Manager automatically
aws rds create-db-instance \
    --db-instance-identifier bizpilot-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 16 \
    --master-username bizpilotadmin \
    --manage-master-user-password \
    --allocated-storage 20 \
    --db-name bizpilot \
    --publicly-accessible \
    --db-subnet-group-name bizpilot-db-subnet

# After creation, retrieve the connection string from Secrets Manager
aws secretsmanager list-secrets --filter Key=name,Values=rds
```

### Step 4: Create App Runner Services

See `apprunner-api.yaml` and `apprunner-web.yaml` in this directory for configuration templates.

```bash
# Create API service
aws apprunner create-service --cli-input-yaml file://infrastructure/aws/apprunner-api.yaml

# Create Web service
aws apprunner create-service --cli-input-yaml file://infrastructure/aws/apprunner-web.yaml
```

---

## Option 2: ECS Fargate Deployment

### Using AWS Copilot CLI (Recommended)

AWS Copilot simplifies ECS deployments:

```bash
# Install Copilot CLI
curl -Lo copilot https://github.com/aws/copilot-cli/releases/latest/download/copilot-linux
chmod +x copilot
sudo mv copilot /usr/local/bin/copilot

# Initialize application
copilot app init bizpilot

# Create backend service
copilot svc init --name api --svc-type "Load Balanced Web Service" --dockerfile backend/Dockerfile

# Create frontend service
copilot svc init --name web --svc-type "Load Balanced Web Service" --dockerfile frontend/Dockerfile

# Create database
copilot storage init --name db --storage-type Aurora

# Deploy to production
copilot env deploy --name production
copilot svc deploy --name api --env production
copilot svc deploy --name web --env production
```

---

## Environment Variables

Configure these environment variables for both deployment options:

### Backend (Required)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key (generate with `openssl rand -hex 32`) |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | JSON array of allowed origins |

### Backend (Optional - for full functionality)
| Variable | Description |
|----------|-------------|
| `EMAILS_ENABLED` | Set to `true` to enable email |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (usually 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `FRONTEND_URL` | Frontend URL for callbacks |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |

### Frontend
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NODE_ENV` | `production` |

---

## Using AWS Secrets Manager

For production, store sensitive values in AWS Secrets Manager.
**Important:** Replace placeholder values with your actual credentials before running these commands.

```bash
# Create secret for database credentials
# Replace the URL with your actual RDS connection string
aws secretsmanager create-secret \
    --name bizpilot/database \
    --secret-string '{"url":"postgresql://bizpilotadmin:YOUR_PASSWORD@bizpilot-db.xxxxx.us-east-1.rds.amazonaws.com:5432/bizpilot"}'

# Create secret for JWT signing key (generate a secure random key)
aws secretsmanager create-secret \
    --name bizpilot/jwt \
    --secret-string "{\"key\":\"$(openssl rand -hex 32)\"}"

# Create secret for Paystack (get keys from https://dashboard.paystack.com/#/settings/developers)
aws secretsmanager create-secret \
    --name bizpilot/paystack \
    --secret-string '{"secret_key":"sk_live_xxxxx","public_key":"pk_live_xxxxx"}'

# Create secret for SMTP (get credentials from your email provider)
aws secretsmanager create-secret \
    --name bizpilot/smtp \
    --secret-string '{"host":"smtp.mailgun.org","port":"587","user":"postmaster@mg.yourdomain.com","password":"YOUR_SMTP_PASSWORD"}'
```

---

## SSL/TLS Certificates

For custom domains, use AWS Certificate Manager:

```bash
# Request certificate
aws acm request-certificate \
    --domain-name bizpilot.yourdomain.com \
    --validation-method DNS \
    --subject-alternative-names api.bizpilot.yourdomain.com

# The certificate ARN can be used with ALB or App Runner
```

---

## Monitoring and Logging

### CloudWatch Logs
All App Runner and ECS services automatically log to CloudWatch.

### CloudWatch Alarms
```bash
# Create alarm for API errors
aws cloudwatch put-metric-alarm \
    --alarm-name bizpilot-api-errors \
    --metric-name 5XXError \
    --namespace AWS/AppRunner \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1
```

---

## Cost Estimation

| Service | Estimated Monthly Cost |
|---------|----------------------|
| App Runner (2 services) | ~$20-50 |
| RDS PostgreSQL (t3.micro) | ~$15 |
| ElastiCache Redis (t3.micro) | ~$15 |
| **Total** | **~$50-80** |

For ECS Fargate, costs depend on CPU/memory allocation and can range from $30-200+.

---

## Migrating from Other Providers

### From DigitalOcean
1. Export your PostgreSQL database
2. Import into RDS PostgreSQL
3. Update environment variables
4. Deploy to App Runner or ECS

### From Render
1. Same process - export DB, update config, deploy

The application is fully portable because:
- Uses standard Docker containers
- All configuration via environment variables
- No provider-specific code in the application
