"""Paystack payment service for subscription management."""

import os
import hmac
import hashlib
from typing import Optional
from datetime import datetime, timezone
import httpx
from pydantic import BaseModel

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "")
PAYSTACK_BASE_URL = "https://api.paystack.co"


class PaystackCustomer(BaseModel):
    customer_code: str
    email: str
    id: int


class PaystackTransaction(BaseModel):
    reference: str
    authorization_url: str
    access_code: str


class PaystackService:
    """Service for interacting with Paystack API."""
    
    def __init__(self):
        self.secret_key = PAYSTACK_SECRET_KEY
        self.headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }
    
    async def create_customer(self, email: str, first_name: str, last_name: str, phone: Optional[str] = None) -> Optional[PaystackCustomer]:
        """Create a Paystack customer."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/customer",
                headers=self.headers,
                json={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone": phone,
                },
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status"):
                    customer_data = data["data"]
                    return PaystackCustomer(
                        customer_code=customer_data["customer_code"],
                        email=customer_data["email"],
                        id=customer_data["id"],
                    )
            return None
    
    async def initialize_transaction(
        self,
        email: str,
        amount_cents: int,
        reference: str,
        callback_url: str,
        metadata: Optional[dict] = None,
        plan_code: Optional[str] = None,
    ) -> Optional[PaystackTransaction]:
        """
        Initialize a Paystack transaction.
        Amount is in kobo (cents) - Paystack uses smallest currency unit.
        For ZAR, 1 Rand = 100 cents.
        """
        payload = {
            "email": email,
            "amount": amount_cents,  # Amount in cents/kobo
            "reference": reference,
            "callback_url": callback_url,
            "currency": "ZAR",
            "metadata": metadata or {},
        }
        
        # If this is a subscription, include the plan
        if plan_code:
            payload["plan"] = plan_code
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/transaction/initialize",
                headers=self.headers,
                json=payload,
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status"):
                    tx_data = data["data"]
                    return PaystackTransaction(
                        reference=tx_data["reference"],
                        authorization_url=tx_data["authorization_url"],
                        access_code=tx_data["access_code"],
                    )
            return None
    
    async def verify_transaction(self, reference: str) -> Optional[dict]:
        """Verify a transaction by reference."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
                headers=self.headers,
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status"):
                    return data["data"]
            return None
    
    async def create_subscription(
        self,
        customer_code: str,
        plan_code: str,
        start_date: Optional[datetime] = None,
    ) -> Optional[dict]:
        """Create a subscription for a customer."""
        payload = {
            "customer": customer_code,
            "plan": plan_code,
        }
        
        if start_date:
            payload["start_date"] = start_date.isoformat()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/subscription",
                headers=self.headers,
                json=payload,
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status"):
                    return data["data"]
            return None
    
    async def cancel_subscription(self, subscription_code: str, email_token: str) -> bool:
        """Cancel a subscription."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/subscription/disable",
                headers=self.headers,
                json={
                    "code": subscription_code,
                    "token": email_token,
                },
            )
            
            return response.status_code == 200 and response.json().get("status", False)
    
    async def get_subscription(self, subscription_code: str) -> Optional[dict]:
        """Get subscription details."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PAYSTACK_BASE_URL}/subscription/{subscription_code}",
                headers=self.headers,
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status"):
                    return data["data"]
            return None
    
    async def create_plan(
        self,
        name: str,
        amount_cents: int,
        interval: str,  # "monthly", "yearly", "weekly", "daily"
        description: Optional[str] = None,
    ) -> Optional[dict]:
        """Create a subscription plan."""
        payload = {
            "name": name,
            "amount": amount_cents,
            "interval": interval,
            "currency": "ZAR",
        }
        
        if description:
            payload["description"] = description
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/plan",
                headers=self.headers,
                json=payload,
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                if data.get("status"):
                    return data["data"]
            return None
    
    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str) -> bool:
        """Verify Paystack webhook signature."""
        if not PAYSTACK_SECRET_KEY:
            return False
        
        computed = hmac.new(
            PAYSTACK_SECRET_KEY.encode(),
            payload,
            hashlib.sha512,
        ).hexdigest()
        
        return hmac.compare_digest(computed, signature)
    
    @staticmethod
    def generate_reference(prefix: str = "BP") -> str:
        """Generate a unique transaction reference."""
        import uuid
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        unique = uuid.uuid4().hex[:8].upper()
        return f"{prefix}-{timestamp}-{unique}"


# Singleton instance
paystack_service = PaystackService()
