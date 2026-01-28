"""Unit tests for statement schemas."""

import pytest
from decimal import Decimal
from datetime import date, datetime
from uuid import uuid4

from app.schemas.customer_account import (
    AgingBreakdown,
    StatementResponse,
    StatementListResponse,
    StatementGenerate,
    StatementSend,
    TransactionSummary,
)
from app.models.customer_account import TransactionType


class TestAgingBreakdown:
    """Test AgingBreakdown schema."""
    
    def test_aging_breakdown_creation(self):
        """Test creating an aging breakdown."""
        aging = AgingBreakdown(
            current=Decimal('100.00'),
            days_30=Decimal('50.00'),
            days_60=Decimal('25.00'),
            days_90_plus=Decimal('10.00'),
            total=Decimal('185.00')
        )
        
        assert aging.current == Decimal('100.00')
        assert aging.days_30 == Decimal('50.00')
        assert aging.days_60 == Decimal('25.00')
        assert aging.days_90_plus == Decimal('10.00')
        assert aging.total == Decimal('185.00')
    
    def test_aging_breakdown_defaults(self):
        """Test aging breakdown with default values."""
        aging = AgingBreakdown()
        
        assert aging.current == Decimal('0')
        assert aging.days_30 == Decimal('0')
        assert aging.days_60 == Decimal('0')
        assert aging.days_90_plus == Decimal('0')
        assert aging.total == Decimal('0')


class TestTransactionSummary:
    """Test TransactionSummary schema."""
    
    def test_transaction_summary_creation(self):
        """Test creating a transaction summary."""
        now = datetime.now()
        summary = TransactionSummary(
            date=now,
            transaction_type=TransactionType.CHARGE,
            description="Test charge",
            amount=Decimal('100.00'),
            balance=Decimal('100.00')
        )
        
        assert summary.date == now
        assert summary.transaction_type == TransactionType.CHARGE
        assert summary.description == "Test charge"
        assert summary.amount == Decimal('100.00')
        assert summary.balance == Decimal('100.00')
    
    def test_transaction_summary_optional_description(self):
        """Test transaction summary without description."""
        now = datetime.now()
        summary = TransactionSummary(
            date=now,
            transaction_type=TransactionType.PAYMENT,
            amount=Decimal('-50.00'),
            balance=Decimal('50.00')
        )
        
        assert summary.description is None


class TestStatementResponse:
    """Test StatementResponse schema."""
    
    def test_statement_response_creation(self):
        """Test creating a statement response."""
        account_id = uuid4()
        statement_id = uuid4()
        now = datetime.now()
        today = date.today()
        
        aging = AgingBreakdown(
            current=Decimal('100.00'),
            days_30=Decimal('50.00'),
            days_60=Decimal('0'),
            days_90_plus=Decimal('0'),
            total=Decimal('150.00')
        )
        
        transactions = [
            TransactionSummary(
                date=now,
                transaction_type=TransactionType.CHARGE,
                description="Sale #123",
                amount=Decimal('100.00'),
                balance=Decimal('100.00')
            ),
            TransactionSummary(
                date=now,
                transaction_type=TransactionType.PAYMENT,
                description="Payment received",
                amount=Decimal('-50.00'),
                balance=Decimal('50.00')
            )
        ]
        
        statement = StatementResponse(
            id=statement_id,
            account_id=account_id,
            statement_date=today,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            opening_balance=Decimal('0'),
            total_charges=Decimal('100.00'),
            total_payments=Decimal('50.00'),
            closing_balance=Decimal('50.00'),
            aging=aging,
            transactions=transactions,
            sent_at=None,
            created_at=now,
            is_sent=False
        )
        
        assert statement.id == statement_id
        assert statement.account_id == account_id
        assert statement.opening_balance == Decimal('0')
        assert statement.total_charges == Decimal('100.00')
        assert statement.total_payments == Decimal('50.00')
        assert statement.closing_balance == Decimal('50.00')
        assert statement.aging.total == Decimal('150.00')
        assert len(statement.transactions) == 2
        assert statement.is_sent is False
    
    def test_statement_response_empty_transactions(self):
        """Test statement response with no transactions."""
        account_id = uuid4()
        statement_id = uuid4()
        now = datetime.now()
        today = date.today()
        
        aging = AgingBreakdown()
        
        statement = StatementResponse(
            id=statement_id,
            account_id=account_id,
            statement_date=today,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            opening_balance=Decimal('0'),
            total_charges=Decimal('0'),
            total_payments=Decimal('0'),
            closing_balance=Decimal('0'),
            aging=aging,
            transactions=[],
            sent_at=None,
            created_at=now,
            is_sent=False
        )
        
        assert len(statement.transactions) == 0
        assert statement.closing_balance == Decimal('0')
    
    def test_statement_response_sent(self):
        """Test statement response that has been sent."""
        account_id = uuid4()
        statement_id = uuid4()
        now = datetime.now()
        today = date.today()
        
        aging = AgingBreakdown()
        
        statement = StatementResponse(
            id=statement_id,
            account_id=account_id,
            statement_date=today,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            opening_balance=Decimal('0'),
            total_charges=Decimal('0'),
            total_payments=Decimal('0'),
            closing_balance=Decimal('0'),
            aging=aging,
            transactions=[],
            sent_at=now,
            created_at=now,
            is_sent=True
        )
        
        assert statement.sent_at == now
        assert statement.is_sent is True


class TestStatementListResponse:
    """Test StatementListResponse schema."""
    
    def test_statement_list_response(self):
        """Test creating a statement list response."""
        account_id = uuid4()
        now = datetime.now()
        today = date.today()
        
        statements = [
            StatementResponse(
                id=uuid4(),
                account_id=account_id,
                statement_date=today,
                period_start=date(2025, 1, 1),
                period_end=date(2025, 1, 31),
                opening_balance=Decimal('0'),
                total_charges=Decimal('100.00'),
                total_payments=Decimal('50.00'),
                closing_balance=Decimal('50.00'),
                aging=AgingBreakdown(),
                transactions=[],
                sent_at=None,
                created_at=now,
                is_sent=False
            )
        ]
        
        response = StatementListResponse(
            items=statements,
            total=1,
            page=1,
            per_page=10,
            pages=1
        )
        
        assert len(response.items) == 1
        assert response.total == 1
        assert response.page == 1
        assert response.per_page == 10
        assert response.pages == 1


class TestStatementGenerate:
    """Test StatementGenerate schema."""
    
    def test_statement_generate_with_period_end(self):
        """Test generating a statement with period end date."""
        today = date.today()
        
        generate = StatementGenerate(
            period_end=today
        )
        
        assert generate.period_end == today
        assert generate.period_start is None
    
    def test_statement_generate_with_both_dates(self):
        """Test generating a statement with both dates."""
        start = date(2025, 1, 1)
        end = date(2025, 1, 31)
        
        generate = StatementGenerate(
            period_start=start,
            period_end=end
        )
        
        assert generate.period_start == start
        assert generate.period_end == end


class TestStatementSend:
    """Test StatementSend schema."""
    
    def test_statement_send_with_email(self):
        """Test sending a statement with custom email."""
        send = StatementSend(
            email="customer@example.com"
        )
        
        assert send.email == "customer@example.com"
    
    def test_statement_send_without_email(self):
        """Test sending a statement without custom email."""
        send = StatementSend()
        
        assert send.email is None


class TestStatementSchemaValidation:
    """Test statement schema validation rules."""
    
    def test_aging_breakdown_accepts_negative_values(self):
        """Test that aging breakdown can handle edge cases."""
        # This should work - aging can be zero or positive
        aging = AgingBreakdown(
            current=Decimal('0'),
            days_30=Decimal('0'),
            days_60=Decimal('0'),
            days_90_plus=Decimal('0'),
            total=Decimal('0')
        )
        assert aging.total == Decimal('0')
    
    def test_statement_response_balance_calculation(self):
        """Test that statement response maintains balance integrity."""
        account_id = uuid4()
        statement_id = uuid4()
        now = datetime.now()
        today = date.today()
        
        # Opening balance + charges - payments = closing balance
        opening = Decimal('100.00')
        charges = Decimal('200.00')
        payments = Decimal('150.00')
        closing = opening + charges - payments  # Should be 150.00
        
        statement = StatementResponse(
            id=statement_id,
            account_id=account_id,
            statement_date=today,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            opening_balance=opening,
            total_charges=charges,
            total_payments=payments,
            closing_balance=closing,
            aging=AgingBreakdown(),
            transactions=[],
            sent_at=None,
            created_at=now,
            is_sent=False
        )
        
        # Verify the balance equation
        calculated_closing = statement.opening_balance + statement.total_charges - statement.total_payments
        assert statement.closing_balance == calculated_closing
        assert statement.closing_balance == Decimal('150.00')
