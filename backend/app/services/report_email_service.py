"""Service for generating and sending report emails."""

import logging
from typing import Optional, List
import io
import pandas as pd

from app.services.email_service import EmailService, EmailAttachment
from app.services.report_generator_service import ReportData
from app.models.report_subscription import ReportType

logger = logging.getLogger(__name__)


class ReportEmailService:
    """Service for report email generation and sending."""

    def __init__(self, email_service: EmailService):
        self.email_service = email_service

    def generate_subject(self, report_data: ReportData) -> str:
        """Generate email subject line."""
        period_str = f"{report_data.period_start.strftime('%Y-%m-%d')} to {report_data.period_end.strftime('%Y-%m-%d')}"
        report_name = report_data.report_type.value.replace('_', ' ').title()
        return f"{report_data.business_name}: {report_name} ({period_str})"

    def generate_html_body(self, report_data: ReportData) -> str:
        """Generate HTML email body."""
        # Simple HTML template for now
        report_name = report_data.report_type.value.replace('_', ' ').title()
        
        metrics_html = "<ul>"
        for key, value in report_data.metrics.items():
            if isinstance(value, (list, dict)):
                continue  # Skip complex metrics for simple list
            formatted_key = key.replace('_', ' ').title()
            metrics_html += f"<li><strong>{formatted_key}:</strong> {value}</li>"
        metrics_html += "</ul>"
        
        # Add tables for lists (e.g. top products)
        tables_html = ""
        if 'top_products' in report_data.metrics:
            tables_html += "<h3>Top Products</h3><table border='1' cellpadding='5' style='border-collapse: collapse; width: 100%;'><tr><th>Name</th><th>Quantity</th><th>Revenue</th></tr>"
            for p in report_data.metrics['top_products']:
                tables_html += f"<tr><td>{p['name']}</td><td>{p['quantity']}</td><td>{report_data.metrics.get('currency', '')} {p['revenue']}</td></tr>"
            tables_html += "</table>"
            
        if 'low_stock_items' in report_data.metrics and report_data.metrics['low_stock_items']:
            tables_html += "<h3>Low Stock Items</h3><table border='1' cellpadding='5' style='border-collapse: collapse; width: 100%;'><tr><th>Name</th><th>SKU</th><th>Quantity</th><th>Reorder Point</th></tr>"
            for p in report_data.metrics['low_stock_items']:
                tables_html += f"<tr><td>{p['name']}</td><td>{p['sku']}</td><td>{p['quantity']}</td><td>{p['reorder_point']}</td></tr>"
            tables_html += "</table>"

        return f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; color: #333; }}
                .header {{ background-color: #f8f9fa; padding: 20px; border-bottom: 1px solid #e9ecef; }}
                .content {{ padding: 20px; }}
                .footer {{ padding: 20px; font-size: 12px; color: #6c757d; border-top: 1px solid #e9ecef; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>{report_data.business_name}</h2>
                <h3>{report_name}</h3>
                <p>Period: {report_data.period_start.strftime('%Y-%m-%d')} - {report_data.period_end.strftime('%Y-%m-%d')}</p>
            </div>
            <div class="content">
                <h3>Summary Metrics</h3>
                {metrics_html}
                {tables_html}
            </div>
            <div class="footer">
                <p>This is an automated report from BizPilot.</p>
                <p><a href="/reports/{report_data.business_id}">View full report in BizPilot</a></p>
                <p><a href="/settings/report-subscriptions?unsubscribe={report_data.report_type.value}">Unsubscribe</a> from these reports.</p>
            </div>
        </body>
        </html>
        """

    def generate_excel_attachment(self, report_data: ReportData) -> EmailAttachment:
        """Generate Excel attachment for the report."""
        output = io.BytesIO()
        
        # Flatten metrics for Excel
        # Simple metrics sheet
        simple_metrics = {k: v for k, v in report_data.metrics.items() if not isinstance(v, (list, dict))}
        df_summary = pd.DataFrame([simple_metrics])
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_summary.to_excel(writer, sheet_name='Summary', index=False)
            
            # Additional sheets for lists
            if 'top_products' in report_data.metrics:
                pd.DataFrame(report_data.metrics['top_products']).to_excel(writer, sheet_name='Top Products', index=False)
                
            if 'low_stock_items' in report_data.metrics:
                pd.DataFrame(report_data.metrics['low_stock_items']).to_excel(writer, sheet_name='Low Stock', index=False)
                
            if 'out_of_stock_items' in report_data.metrics:
                pd.DataFrame(report_data.metrics['out_of_stock_items']).to_excel(writer, sheet_name='Out of Stock', index=False)
                
            if 'top_customers' in report_data.metrics:
                pd.DataFrame(report_data.metrics['top_customers']).to_excel(writer, sheet_name='Top Customers', index=False)

        output.seek(0)
        filename = f"{report_data.report_type.value}_{report_data.period_end.strftime('%Y%m%d')}.xlsx"
        
        return EmailAttachment(
            filename=filename,
            content=output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    def send_report_email(self, report_data: ReportData, include_excel: bool = False) -> None:
        """Send the report email."""
        subject = self.generate_subject(report_data)
        body = self.generate_html_body(report_data)
        
        attachments = []
        if include_excel:
            try:
                attachments.append(self.generate_excel_attachment(report_data))
            except Exception as e:
                logger.error(f"Failed to generate Excel attachment: {e}")
        
        self.email_service.send_email(
            to_email=report_data.user_email,
            subject=subject,
            body_text="Please view this email in a client that supports HTML.", # Fallback plain text
            attachments=attachments if attachments else None
        )
