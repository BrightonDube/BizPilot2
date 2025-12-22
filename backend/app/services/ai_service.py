from __future__ import annotations

from typing import Any, Literal, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.business import Business
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.inventory import InventoryItem
from app.models.product import Product
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel, UserSettings


ChatRole = Literal["system", "user", "assistant"]


class AIService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_user_settings(self, user_id) -> UserSettings:
        existing = (
            self.db.query(UserSettings)
            .filter(UserSettings.user_id == user_id, UserSettings.deleted_at.is_(None))
            .first()
        )
        if existing:
            return existing

        settings_row = UserSettings(user_id=user_id, ai_data_sharing_level=AIDataSharingLevel.NONE)
        self.db.add(settings_row)
        self.db.commit()
        self.db.refresh(settings_row)
        return settings_row

    def update_user_settings(self, user_id, ai_data_sharing_level: AIDataSharingLevel) -> UserSettings:
        settings_row = self.get_or_create_user_settings(user_id)
        settings_row.ai_data_sharing_level = ai_data_sharing_level
        self.db.commit()
        self.db.refresh(settings_row)
        return settings_row

    def _require_conversation_for_user(self, conversation_id, user_id) -> AIConversation:
        convo = (
            self.db.query(AIConversation)
            .filter(
                AIConversation.id == conversation_id,
                AIConversation.user_id == user_id,
                AIConversation.deleted_at.is_(None),
            )
            .first()
        )
        if not convo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return convo

    def list_conversations(self, user_id) -> list[AIConversation]:
        return (
            self.db.query(AIConversation)
            .filter(AIConversation.user_id == user_id, AIConversation.deleted_at.is_(None))
            .order_by(AIConversation.updated_at.desc())
            .all()
        )

    def create_conversation(self, user_id, title: str | None = None) -> AIConversation:
        convo = AIConversation(user_id=user_id, title=title or "New Conversation")
        self.db.add(convo)
        self.db.commit()
        self.db.refresh(convo)

        welcome = AIMessage(
            conversation_id=convo.id,
            is_user=False,
            content=(
                "Hello! I'm your BizPilot AI assistant. I can help with pricing, inventory, invoices, and how to use the app."
            ),
        )
        self.db.add(welcome)
        self.db.commit()

        return convo

    def delete_conversation(self, user_id, conversation_id) -> None:
        convo = self._require_conversation_for_user(conversation_id, user_id)
        convo.soft_delete()
        self.db.commit()

    def list_messages(self, user_id, conversation_id) -> list[AIMessage]:
        convo = self._require_conversation_for_user(conversation_id, user_id)
        return (
            self.db.query(AIMessage)
            .filter(AIMessage.conversation_id == convo.id, AIMessage.deleted_at.is_(None))
            .order_by(AIMessage.created_at.asc())
            .all()
        )

    def add_message(self, user_id, conversation_id, content: str, is_user: bool) -> AIMessage:
        convo = self._require_conversation_for_user(conversation_id, user_id)
        msg = AIMessage(conversation_id=convo.id, content=content, is_user=is_user)
        self.db.add(msg)
        convo.updated_at = msg.created_at
        self.db.commit()
        self.db.refresh(msg)
        return msg

    def _get_business_for_user(self, user_id) -> Optional[Business]:
        business_user = (
            self.db.query(BusinessUser)
            .filter(BusinessUser.user_id == user_id, BusinessUser.status == BusinessUserStatus.ACTIVE)
            .first()
        )
        if not business_user:
            return None
        return self.db.query(Business).filter(Business.id == business_user.business_id).first()

    def build_business_context(self, user: User, level: AIDataSharingLevel) -> dict[str, Any]:
        business = self._get_business_for_user(user.id)
        if not business:
            return {
                "businessName": "",
                "totalProducts": 0,
                "totalInventoryItems": 0,
                "lowStockItems": 0,
                "avgMargin": 0,
            }

        if level in (AIDataSharingLevel.NONE, AIDataSharingLevel.APP_ONLY):
            return {
                "businessName": business.name,
                "totalProducts": 0,
                "totalInventoryItems": 0,
                "lowStockItems": 0,
                "avgMargin": 0,
            }

        total_products = (
            self.db.query(func.count(Product.id))
            .filter(Product.business_id == business.id, Product.deleted_at.is_(None))
            .scalar()
            or 0
        )
        total_inventory_items = (
            self.db.query(func.count(InventoryItem.id))
            .filter(InventoryItem.business_id == business.id, InventoryItem.deleted_at.is_(None))
            .scalar()
            or 0
        )
        low_stock_items = (
            self.db.query(func.count(InventoryItem.id))
            .filter(
                InventoryItem.business_id == business.id,
                InventoryItem.deleted_at.is_(None),
                InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
            )
            .scalar()
            or 0
        )

        products = (
            self.db.query(Product)
            .filter(Product.business_id == business.id, Product.deleted_at.is_(None))
            .all()
        )
        margins = [p.profit_margin for p in products] if products else []
        avg_margin = (sum(margins) / len(margins)) if margins else 0

        context: dict[str, Any] = {
            "businessName": business.name,
            "currency": business.currency,
            "totalProducts": int(total_products),
            "totalInventoryItems": int(total_inventory_items),
            "lowStockItems": int(low_stock_items),
            "avgMargin": float(avg_margin),
        }

        if level == AIDataSharingLevel.METRICS_ONLY:
            return context

        top_products = sorted(products, key=lambda p: p.profit_margin, reverse=True)[:10]
        context["topProductsByMargin"] = [
            {
                "name": p.name,
                "sku": p.sku,
                "selling_price": float(p.selling_price),
                "effective_cost": float(p.effective_cost or 0),
                "profit_margin": float(p.profit_margin),
                "is_low_stock": bool(p.is_low_stock),
            }
            for p in top_products
        ]

        low_stock_inventory = (
            self.db.query(InventoryItem)
            .filter(
                InventoryItem.business_id == business.id,
                InventoryItem.deleted_at.is_(None),
                InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
            )
            .order_by(InventoryItem.quantity_on_hand.asc())
            .limit(20)
            .all()
        )
        context["lowStockInventory"] = [
            {
                "product_id": str(i.product_id),
                "quantity_on_hand": int(i.quantity_on_hand),
                "reorder_point": int(i.reorder_point),
                "location": i.location,
            }
            for i in low_stock_inventory
        ]

        return context

    def build_app_help_context(self) -> dict[str, Any]:
        return {
            "appName": settings.APP_NAME,
            "routes": {
                "dashboard": "/dashboard",
                "products": "/products",
                "create_product": "/products/new",
                "inventory": "/inventory",
                "create_inventory_item": "/inventory/new",
                "customers": "/customers",
                "create_customer": "/customers/new",
                "invoices": "/invoices",
                "create_invoice": "/invoices/new",
                "payments": "/payments",
                "record_payment": "/payments/new",
                "reports": "/reports",
                "settings": "/settings",
            },
            "commonTasks": {
                "create_invoice": [
                    "Go to Invoices",
                    "Click New Invoice",
                    "Select a customer",
                    "Add line items",
                    "Set due date and notes (optional)",
                    "Save invoice",
                ],
                "record_payment": [
                    "Open an invoice",
                    "Click Record Payment",
                    "Enter amount and method",
                    "Save payment",
                ],
            },
        }

    def detect_context_mode(self, message: str) -> Literal["app_help", "business", "mixed"]:
        m = message.lower()
        app_triggers = ["how do i", "where do i", "where can i", "how to", "steps", "click", "navigate"]
        business_triggers = [
            "profit",
            "margin",
            "revenue",
            "sales",
            "inventory",
            "stock",
            "cost",
            "pricing",
            "customer",
            "invoice",
        ]

        app_like = any(t in m for t in app_triggers)
        business_like = any(t in m for t in business_triggers)

        if app_like and business_like:
            return "mixed"
        if app_like:
            return "app_help"
        if business_like:
            return "business"
        return "mixed"

    async def _call_groq(self, messages: list[dict[str, Any]]) -> str:
        if not settings.GROQ_API_KEY:
            raise RuntimeError("Groq API key not configured")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 1,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            if not content:
                raise RuntimeError("No response content from Groq")
            return str(content)

    async def generate_conversation_title(self, first_message: str) -> str:
        if not settings.GROQ_API_KEY:
            return "New Conversation"

        prompt = (
            f"Generate a short, descriptive title (max 4 words) for a conversation that starts with: \"{first_message}\". "
            "Only return the title, nothing else."
        )

        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        try:
            title = await self._call_groq(messages)
            cleaned = title.strip().strip('"')
            return cleaned[:80] if cleaned else "New Conversation"
        except Exception:
            return "New Conversation"

    async def send_message(
        self,
        user: User,
        content: str,
        conversation_id=None,
    ) -> dict[str, Any]:
        user_settings = self.get_or_create_user_settings(user.id)

        if conversation_id is None:
            convo = self.create_conversation(user.id)
        else:
            convo = self._require_conversation_for_user(conversation_id, user.id)

        self.add_message(user.id, convo.id, content, True)

        if not settings.GROQ_API_KEY:
            assistant_text = "AI service is not configured yet."
            self.add_message(user.id, convo.id, assistant_text, False)
            return {"response": assistant_text, "conversation_id": str(convo.id)}

        mode = self.detect_context_mode(content)

        app_ctx: dict[str, Any] | None = None
        biz_ctx: dict[str, Any] | None = None

        if user_settings.ai_data_sharing_level != AIDataSharingLevel.NONE:
            if mode in ("app_help", "mixed") and user_settings.ai_data_sharing_level in (
                AIDataSharingLevel.APP_ONLY,
                AIDataSharingLevel.METRICS_ONLY,
                AIDataSharingLevel.FULL_BUSINESS,
                AIDataSharingLevel.FULL_BUSINESS_WITH_CUSTOMERS,
            ):
                app_ctx = self.build_app_help_context()

            if mode in ("business", "mixed"):
                biz_ctx = self.build_business_context(user, user_settings.ai_data_sharing_level)

        history = (
            self.db.query(AIMessage)
            .filter(AIMessage.conversation_id == convo.id, AIMessage.deleted_at.is_(None))
            .order_by(AIMessage.created_at.asc())
            .all()
        )

        chat_history = [
            {
                "role": ("user" if m.is_user else "assistant"),
                "content": m.content,
            }
            for m in history
        ]

        system_prompt = {
            "role": "system",
            "content": (
                "You are a helpful assistant for BizPilot. "
                "If the user asks how to do something in the app, provide step-by-step guidance using the app context. "
                "If they ask business questions, use the business context (respect privacy constraints). "
                f"App context: {app_ctx if app_ctx is not None else {}}\n"
                f"Business context: {biz_ctx if biz_ctx is not None else {}}\n"
            ),
        }

        messages: list[dict[str, Any]] = [system_prompt]
        messages.extend(chat_history[-10:])
        messages.append({"role": "user", "content": content})

        assistant_text = await self._call_groq(messages)
        self.add_message(user.id, convo.id, assistant_text, False)

        user_msgs = [m for m in history if m.is_user]
        if len(user_msgs) == 0:
            title = await self.generate_conversation_title(content)
            convo.title = title
            self.db.commit()

        return {"response": assistant_text, "conversation_id": str(convo.id)}
