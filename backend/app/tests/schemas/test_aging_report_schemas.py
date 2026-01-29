"""Unit tests for aging and report schemas."""

import pytest
from decimal import Decimal
from datetime import date, datetime
from uuid import uuid4

from app.schemas.customer_account import (
    AgingBreakdown,
    AgingReportFilters,
    AgingReportResponse,
    CreditUtilizationReport,
    CreditUtilizationSummary,
    BadDebtReport,
    BadDebtSummary,
    PaymentHistoryReport,
    AccountActivityReport,
    DashboardWidget,
    ARDashboard,
    ReportExportRequest,
    ReportExportResponse,
    OverdueAccount,
    ARSummary,
)
from app.models.customer_account import AccountStatus


class TestAgingBreakdown:
    """Test AgingBreakdown schema."""
    
    def test_aging_breakdown_valid(self):
        """Test valid aging breakdown."""
        aging = AgingBreakdown(
            current=Decimal("1000.00"),
            days_30=Decimal("500.00"),
            days_60=Decimal("300.00"),
            days_90_plus=Decimal("200.00"),
            total=Decimal("2000.00")
        )
        assert aging.current == Decimal("1000.00")
        assert aging.total == Decimal("2000.00")
    
    def test_aging_breakdown_defaults(self):
        """Test aging breakdown with default values."""
        aging = AgingBreakdown()
        assert aging.current == Decimal("0")
        assert aging.days_30 == Decimal("0")
        assert aging.total == Decimal("0")


class TestAgingReportFilters:
    """Test AgingReportFilters schema."""
    
    def test_filters_valid(self):
        """Test valid aging report filters."""
        filters = AgingReportFilters(
            customer_type="wholesale",
            min_balance=Decimal("100.00"),
            max_balance=Decimal("10000.00"),
            include_current=False,
            include_suspended=True,
            sort_by="balance",
            sort_order="asc"
        )
        assert filters.customer_type == "wholesale"
        assert filters.min_balance == Decimal("100.00")
        assert filters.sort_by == "balance"
    
    def test_filters_defaults(self):
        """Test aging report filters with defaults."""
        filters = AgingReportFilters()
        assert filters.include_current is True
        assert filters.include_suspended is False
        assert filters.sort_by == "days_overdue"
        assert filters.sort_order == "desc"
    
    def test_filters_negative_balance_rejected(self):
        """Test that negative balance is rejected."""
        with pytest.raises(ValueError):
            AgingReportFilters(min_balance=Decimal("-100.00"))


class TestAgingReportResponse:
    """Test AgingReportResponse schema."""
    
    def test_aging_report_valid(self):
        """Test valid aging report response."""
        account_id = uuid4()
        customer_id = uuid4()
        business_id = uuid4()
        
        overdue_account = OverdueAccount(
            account_id=account_id,
            customer_id=customer_id,
            customer_name="Test Customer",
            account_number="ACC-001",
            current_balance=Decimal("1500.00"),
            days_overdue=45,
            oldest_invoice_date=date(2024, 1, 1),
            aging=AgingBreakdown(
                current=Decimal("0"),
                days_30=Decimal("500.00"),
                days_60=Decimal("1000.00"),
                days_90_plus=Decimal("0"),
                total=Decimal("1500.00")
            )
        )
        
        report = AgingReportResponse(
            report_date=date.today(),
            business_id=business_id,
            accounts=[overdue_account],
            summary=AgingBreakdown(
                current=Decimal("0"),
                days_30=Decimal("500.00"),
                days_60=Decimal("1000.00"),
                days_90_plus=Decimal("0"),
                total=Decimal("1500.00")
            ),
            total_accounts=1
        )
        
        assert report.total_accounts == 1
        assert len(report.accounts) == 1
        assert report.summary.total == Decimal("1500.00")


class TestCreditUtilizationReport:
    """Test CreditUtilizationReport schema."""
    
    def test_credit_utilization_valid(self):
        """Test valid credit utilization report."""
        account_id = uuid4()
        customer_id = uuid4()
        
        report = CreditUtilizationReport(
            account_id=account_id,
            customer_id=customer_id,
            customer_name="Test Customer",
            account_number="ACC-001",
            credit_limit=Decimal("10000.00"),
            current_balance=Decimal("7500.00"),
            available_credit=Decimal("2500.00"),
            utilization_percentage=75.0,
            status=AccountStatus.ACTIVE
        )
        
        assert report.utilization_percentage == 75.0
        assert report.available_credit == Decimal("2500.00")
        assert report.status == AccountStatus.ACTIVE


class TestCreditUtilizationSummary:
    """Test CreditUtilizationSummary schema."""
    
    def test_utilization_summary_valid(self):
        """Test valid credit utilization summary."""
        account_id = uuid4()
        customer_id = uuid4()
        
        report = CreditUtilizationReport(
            account_id=account_id,
            customer_id=customer_id,
            customer_name="Test Customer",
            account_number="ACC-001",
            credit_limit=Decimal("10000.00"),
            current_balance=Decimal("8500.00"),
            available_credit=Decimal("1500.00"),
            utilization_percentage=85.0,
            status=AccountStatus.ACTIVE
        )
        
        summary = CreditUtilizationSummary(
            accounts=[report],
            total_credit_extended=Decimal("10000.00"),
            total_credit_used=Decimal("8500.00"),
            average_utilization=85.0,
            accounts_over_80_percent=1,
            accounts_at_limit=0
        )
        
        assert summary.average_utilization == 85.0
        assert summary.accounts_over_80_percent == 1
        assert len(summary.accounts) == 1


class TestBadDebtReport:
    """Test BadDebtReport schema."""
    
    def test_bad_debt_report_valid(self):
        """Test valid bad debt report."""
        account_id = uuid4()
        customer_id = uuid4()
        approved_by = uuid4()
        
        report = BadDebtReport(
            account_id=account_id,
            customer_id=customer_id,
            customer_name="Test Customer",
            account_number="ACC-001",
            write_off_amount=Decimal("5000.00"),
            write_off_date=datetime.now(),
            reason="Customer bankruptcy",
            approved_by=approved_by
        )
        
        assert report.write_off_amount == Decimal("5000.00")
        assert report.reason == "Customer bankruptcy"
        assert report.approved_by == approved_by


class TestBadDebtSummary:
    """Test BadDebtSummary schema."""
    
    def test_bad_debt_summary_valid(self):
        """Test valid bad debt summary."""
        account_id = uuid4()
        customer_id = uuid4()
        
        write_off = BadDebtReport(
            account_id=account_id,
            customer_id=customer_id,
            customer_name="Test Customer",
            account_number="ACC-001",
            write_off_amount=Decimal("5000.00"),
            write_off_date=datetime.now(),
            reason="Uncollectable"
        )
        
        summary = BadDebtSummary(
            write_offs=[write_off],
            total_write_offs=Decimal("5000.00"),
            write_off_count=1,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
            write_off_rate=2.5
        )
        
        assert summary.total_write_offs == Decimal("5000.00")
        assert summary.write_off_count == 1
        assert summary.write_off_rate == 2.5


class TestPaymentHistoryReport:
    """Test PaymentHistoryReport schema."""
    
    def test_payment_history_valid(self):
        """Test valid payment history report."""
        account_id = uuid4()
        customer_id = uuid4()
        
        report = PaymentHistoryReport(
            account_id=account_id,
            customer_id=customer_id,
            customer_name="Test Customer",
            account_number="ACC-001",
            total_payments=Decimal("50000.00"),
            payment_count=25,
            average_payment_amount=Decimal("2000.00"),
            average_days_to_pay=28.5,
            on_time_payment_rate=0.92,
            last_payment_date=datetime.now(),
            payment_trend="improving"
        )
        
        assert report.payment_count == 25
        assert report.on_time_payment_rate == 0.92
        assert report.payment_trend == "improving"


class TestAccountActivityReport:
    """Test AccountActivityReport schema."""
    
    def test_activity_report_valid(self):
        """Test valid account activity report."""
        account_id = uuid4()
        customer_id = uuid4()
        
        report = AccountActivityReport(
            account_id=account_id,
            customer_id=customer_id,
            customer_name="Test Customer",
            account_number="ACC-001",
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31),
            opening_balance=Decimal("1000.00"),
            total_charges=Decimal("50000.00"),
            total_payments=Decimal("48000.00"),
            total_adjustments=Decimal("-500.00"),
            closing_balance=Decimal("2500.00"),
            transaction_count=75,
            average_transaction_size=Decimal("666.67")
        )
        
        assert report.transaction_count == 75
        assert report.closing_balance == Decimal("2500.00")


class TestDashboardWidget:
    """Test DashboardWidget schema."""
    
    def test_dashboard_widget_valid(self):
        """Test valid dashboard widget."""
        widget = DashboardWidget(
            widget_type="ar_summary",
            title="Accounts Receivable Summary",
            data={
                "total_receivable": "50000.00",
                "overdue_accounts": 5
            },
            last_updated=datetime.now()
        )
        
        assert widget.widget_type == "ar_summary"
        assert "total_receivable" in widget.data


class TestARDashboard:
    """Test ARDashboard schema."""
    
    def test_ar_dashboard_valid(self):
        """Test valid AR dashboard."""
        business_id = uuid4()
        
        summary = ARSummary(
            total_receivable=Decimal("50000.00"),
            total_accounts=20,
            active_accounts=18,
            overdue_accounts=5,
            total_overdue=Decimal("8000.00"),
            average_days_overdue=35.5,
            aging_breakdown=AgingBreakdown(
                current=Decimal("42000.00"),
                days_30=Decimal("3000.00"),
                days_60=Decimal("3000.00"),
                days_90_plus=Decimal("2000.00"),
                total=Decimal("50000.00")
            )
        )
        
        widget = DashboardWidget(
            widget_type="top_debtors",
            title="Top 5 Debtors",
            data={"debtors": []},
            last_updated=datetime.now()
        )
        
        dashboard = ARDashboard(
            business_id=business_id,
            summary=summary,
            widgets=[widget],
            generated_at=datetime.now()
        )
        
        assert dashboard.summary.total_receivable == Decimal("50000.00")
        assert len(dashboard.widgets) == 1


class TestReportExportRequest:
    """Test ReportExportRequest schema."""
    
    def test_export_request_valid(self):
        """Test valid report export request."""
        request = ReportExportRequest(
            report_type="aging",
            format="pdf",
            filters={"customer_type": "wholesale"},
            include_details=True
        )
        
        assert request.report_type == "aging"
        assert request.format == "pdf"
        assert request.include_details is True
    
    def test_export_request_minimal(self):
        """Test minimal export request."""
        request = ReportExportRequest(
            report_type="ar_summary",
            format="csv"
        )
        
        assert request.filters is None
        assert request.include_details is True


class TestReportExportResponse:
    """Test ReportExportResponse schema."""
    
    def test_export_response_valid(self):
        """Test valid report export response."""
        export_id = uuid4()
        
        response = ReportExportResponse(
            export_id=export_id,
            report_type="aging",
            format="pdf",
            file_url="https://example.com/reports/aging-2024.pdf",
            file_size=1024000,
            status="completed",
            created_at=datetime.now(),
            expires_at=datetime(2024, 12, 31)
        )
        
        assert response.status == "completed"
        assert response.file_url is not None
        assert response.file_size == 1024000
    
    def test_export_response_pending(self):
        """Test pending export response."""
        export_id = uuid4()
        
        response = ReportExportResponse(
            export_id=export_id,
            report_type="dso",
            format="xlsx",
            status="pending",
            created_at=datetime.now()
        )
        
        assert response.status == "pending"
        assert response.file_url is None
