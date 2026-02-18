"""Sales report service for detailed sales analytics."""

from datetime import date, datetime, timedelta
from uuid import UUID
import calendar

from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem, OrderDirection, OrderStatus
from app.models.product import Product, ProductCategory


class SalesReportService:
    """Service for generating detailed sales reports."""

    def __init__(self, db: Session):
        self.db = db

    def _base_sales_filter(self, query, business_id, start_date, end_date):
        """Apply common filters: business, date range, direction, not deleted."""
        return query.filter(
            Order.business_id == str(business_id),
            Order.direction == OrderDirection.OUTBOUND,
            Order.deleted_at.is_(None),
            Order.created_at >= start_date,
            Order.created_at < end_date,
        )

    def _get_period_totals(self, business_id, start_date, end_date) -> dict:
        """Get aggregate totals for a date range."""
        row = (
            self.db.query(
                func.coalesce(func.sum(Order.total), 0).label("gross_sales"),
                func.coalesce(func.sum(Order.discount_amount), 0).label("discounts"),
                func.coalesce(func.sum(Order.tax_amount), 0).label("tax"),
                func.count(Order.id).label("transaction_count"),
            )
        )
        row = self._base_sales_filter(row, business_id, start_date, end_date)
        row = row.one()

        gross_sales = float(row.gross_sales)
        discounts = float(row.discounts)
        tax = float(row.tax)
        transaction_count = int(row.transaction_count)

        # Count refunded orders separately
        refund_row = (
            self.db.query(
                func.coalesce(func.sum(Order.total), 0).label("refunds"),
            )
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                Order.status == OrderStatus.REFUNDED,
                Order.created_at >= start_date,
                Order.created_at < end_date,
            )
            .one()
        )
        refunds = float(refund_row.refunds)

        net_sales = gross_sales - discounts - refunds
        atv = gross_sales / transaction_count if transaction_count > 0 else 0.0

        return {
            "gross_sales": round(gross_sales, 2),
            "net_sales": round(net_sales, 2),
            "discounts": round(discounts, 2),
            "refunds": round(refunds, 2),
            "tax": round(tax, 2),
            "transaction_count": transaction_count,
            "average_transaction_value": round(atv, 2),
        }

    def _calc_change(self, current: float, previous: float) -> float:
        """Calculate percentage change."""
        if previous == 0:
            return 0.0
        return round(((current - previous) / previous) * 100, 1)

    def get_daily_report(self, business_id: UUID, target_date: date) -> dict:
        """Daily sales report with hourly breakdown and comparisons."""
        start = datetime.combine(target_date, datetime.min.time())
        end = start + timedelta(days=1)

        totals = self._get_period_totals(business_id, start, end)

        # Hourly breakdown
        hourly_rows = (
            self.db.query(
                extract("hour", Order.created_at).label("hour"),
                func.coalesce(func.sum(Order.total), 0).label("sales"),
                func.count(Order.id).label("transactions"),
            )
        )
        hourly_rows = self._base_sales_filter(hourly_rows, business_id, start, end)
        hourly_rows = (
            hourly_rows
            .group_by(extract("hour", Order.created_at))
            .order_by(extract("hour", Order.created_at))
            .all()
        )

        hourly_breakdown = []
        for r in hourly_rows:
            hourly_breakdown.append({
                "hour": int(r.hour),
                "sales": round(float(r.sales), 2),
                "transactions": int(r.transactions),
            })

        # Previous day comparison
        prev_start = start - timedelta(days=1)
        prev_end = start
        prev_totals = self._get_period_totals(business_id, prev_start, prev_end)

        # Same day last week comparison
        week_ago_start = start - timedelta(days=7)
        week_ago_end = end - timedelta(days=7)
        week_ago_totals = self._get_period_totals(business_id, week_ago_start, week_ago_end)

        return {
            "date": target_date.isoformat(),
            "summary": totals,
            "hourly_breakdown": hourly_breakdown,
            "comparisons": {
                "previous_day": {
                    "gross_sales": prev_totals["gross_sales"],
                    "change_percent": self._calc_change(
                        totals["gross_sales"], prev_totals["gross_sales"]
                    ),
                },
                "same_day_last_week": {
                    "gross_sales": week_ago_totals["gross_sales"],
                    "change_percent": self._calc_change(
                        totals["gross_sales"], week_ago_totals["gross_sales"]
                    ),
                },
            },
        }

    def get_weekly_report(self, business_id: UUID, week_start: date) -> dict:
        """Weekly sales report with daily breakdown."""
        # Ensure week_start is a Monday
        start = datetime.combine(week_start, datetime.min.time())
        end = start + timedelta(days=7)

        totals = self._get_period_totals(business_id, start, end)

        # Daily breakdown
        daily_rows = (
            self.db.query(
                func.date(Order.created_at).label("day"),
                func.coalesce(func.sum(Order.total), 0).label("sales"),
                func.count(Order.id).label("transactions"),
            )
        )
        daily_rows = self._base_sales_filter(daily_rows, business_id, start, end)
        daily_rows = (
            daily_rows
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at))
            .all()
        )

        daily_breakdown = []
        best_day = None
        worst_day = None
        for r in daily_rows:
            day_str = str(r.day)
            sales = round(float(r.sales), 2)
            entry = {
                "date": day_str,
                "sales": sales,
                "transactions": int(r.transactions),
            }
            daily_breakdown.append(entry)
            if best_day is None or sales > best_day["sales"]:
                best_day = entry
            if worst_day is None or sales < worst_day["sales"]:
                worst_day = entry

        # Previous week comparison
        prev_start = start - timedelta(days=7)
        prev_end = start
        prev_totals = self._get_period_totals(business_id, prev_start, prev_end)

        return {
            "week_start": week_start.isoformat(),
            "week_end": (week_start + timedelta(days=6)).isoformat(),
            "summary": totals,
            "daily_breakdown": daily_breakdown,
            "best_day": best_day,
            "worst_day": worst_day,
            "comparisons": {
                "previous_week": {
                    "gross_sales": prev_totals["gross_sales"],
                    "change_percent": self._calc_change(
                        totals["gross_sales"], prev_totals["gross_sales"]
                    ),
                },
            },
        }

    def get_monthly_report(self, business_id: UUID, year: int, month: int) -> dict:
        """Monthly sales report with daily breakdown."""
        start = datetime(year, month, 1)
        _, last_day = calendar.monthrange(year, month)
        end = datetime(year, month, last_day) + timedelta(days=1)

        totals = self._get_period_totals(business_id, start, end)

        # Daily breakdown
        daily_rows = (
            self.db.query(
                func.date(Order.created_at).label("day"),
                func.coalesce(func.sum(Order.total), 0).label("sales"),
                func.count(Order.id).label("transactions"),
            )
        )
        daily_rows = self._base_sales_filter(daily_rows, business_id, start, end)
        daily_rows = (
            daily_rows
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at))
            .all()
        )

        daily_breakdown = [
            {
                "date": str(r.day),
                "sales": round(float(r.sales), 2),
                "transactions": int(r.transactions),
            }
            for r in daily_rows
        ]

        # Previous month comparison
        if month == 1:
            prev_year, prev_month = year - 1, 12
        else:
            prev_year, prev_month = year, month - 1
        prev_start = datetime(prev_year, prev_month, 1)
        _, prev_last_day = calendar.monthrange(prev_year, prev_month)
        prev_end = datetime(prev_year, prev_month, prev_last_day) + timedelta(days=1)
        prev_totals = self._get_period_totals(business_id, prev_start, prev_end)

        # Same month last year comparison
        ly_start = datetime(year - 1, month, 1)
        _, ly_last_day = calendar.monthrange(year - 1, month)
        ly_end = datetime(year - 1, month, ly_last_day) + timedelta(days=1)
        ly_totals = self._get_period_totals(business_id, ly_start, ly_end)

        return {
            "year": year,
            "month": month,
            "summary": totals,
            "daily_breakdown": daily_breakdown,
            "comparisons": {
                "previous_month": {
                    "gross_sales": prev_totals["gross_sales"],
                    "change_percent": self._calc_change(
                        totals["gross_sales"], prev_totals["gross_sales"]
                    ),
                },
                "same_month_last_year": {
                    "gross_sales": ly_totals["gross_sales"],
                    "change_percent": self._calc_change(
                        totals["gross_sales"], ly_totals["gross_sales"]
                    ),
                },
            },
        }

    def get_product_performance(
        self, business_id: UUID, start_date: date, end_date: date, limit: int = 20
    ) -> dict:
        """Product performance report ranked by revenue."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        rows = (
            self.db.query(
                OrderItem.product_id,
                OrderItem.name.label("product_name"),
                func.coalesce(func.sum(OrderItem.total), 0).label("revenue"),
                func.coalesce(func.sum(OrderItem.quantity), 0).label("quantity_sold"),
                func.count(func.distinct(Order.id)).label("order_count"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                OrderItem.deleted_at.is_(None),
                Order.created_at >= start,
                Order.created_at < end,
            )
            .group_by(OrderItem.product_id, OrderItem.name)
            .order_by(func.coalesce(func.sum(OrderItem.total), 0).desc())
            .limit(limit)
            .all()
        )

        # Total revenue for percentage calculation
        total_revenue = sum(float(r.revenue) for r in rows) if rows else 0.0

        products = []
        for rank, r in enumerate(rows, 1):
            revenue = round(float(r.revenue), 2)
            products.append({
                "rank": rank,
                "product_id": str(r.product_id) if r.product_id else None,
                "product_name": r.product_name,
                "revenue": revenue,
                "quantity_sold": int(r.quantity_sold),
                "order_count": int(r.order_count),
                "revenue_percentage": round(
                    (revenue / total_revenue * 100) if total_revenue > 0 else 0, 1
                ),
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_revenue": round(total_revenue, 2),
            "product_count": len(products),
            "products": products,
        }

    def get_category_performance(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Category performance report."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        rows = (
            self.db.query(
                ProductCategory.id.label("category_id"),
                ProductCategory.name.label("category_name"),
                func.coalesce(func.sum(OrderItem.total), 0).label("revenue"),
                func.coalesce(func.sum(OrderItem.quantity), 0).label("quantity_sold"),
                func.count(func.distinct(Order.id)).label("order_count"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .outerjoin(ProductCategory, ProductCategory.id == Product.category_id)
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                OrderItem.deleted_at.is_(None),
                Product.deleted_at.is_(None),
                Order.created_at >= start,
                Order.created_at < end,
            )
            .group_by(ProductCategory.id, ProductCategory.name)
            .order_by(func.coalesce(func.sum(OrderItem.total), 0).desc())
            .all()
        )

        total_revenue = sum(float(r.revenue) for r in rows) if rows else 0.0

        categories = []
        for r in rows:
            revenue = round(float(r.revenue), 2)
            categories.append({
                "category_id": str(r.category_id) if r.category_id else None,
                "category_name": r.category_name or "Uncategorized",
                "revenue": revenue,
                "quantity_sold": int(r.quantity_sold),
                "order_count": int(r.order_count),
                "revenue_percentage": round(
                    (revenue / total_revenue * 100) if total_revenue > 0 else 0, 1
                ),
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_revenue": round(total_revenue, 2),
            "category_count": len(categories),
            "categories": categories,
        }

    def get_payment_breakdown(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Payment method breakdown."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        rows = (
            self.db.query(
                func.coalesce(Order.payment_method, "unknown").label("payment_method"),
                func.count(Order.id).label("count"),
                func.coalesce(func.sum(Order.total), 0).label("amount"),
            )
        )
        rows = self._base_sales_filter(rows, business_id, start, end)
        rows = (
            rows
            .group_by(func.coalesce(Order.payment_method, "unknown"))
            .order_by(func.coalesce(func.sum(Order.total), 0).desc())
            .all()
        )

        total_amount = sum(float(r.amount) for r in rows) if rows else 0.0
        total_count = sum(int(r.count) for r in rows) if rows else 0

        methods = []
        for r in rows:
            amount = round(float(r.amount), 2)
            count = int(r.count)
            methods.append({
                "payment_method": r.payment_method,
                "count": count,
                "amount": amount,
                "percentage_amount": round(
                    (amount / total_amount * 100) if total_amount > 0 else 0, 1
                ),
                "percentage_count": round(
                    (count / total_count * 100) if total_count > 0 else 0, 1
                ),
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_amount": round(total_amount, 2),
            "total_transactions": total_count,
            "methods": methods,
        }

    def get_time_analysis(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Time-based analysis with peak hours."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        rows = (
            self.db.query(
                extract("hour", Order.created_at).label("hour"),
                func.count(Order.id).label("transactions"),
                func.coalesce(func.sum(Order.total), 0).label("sales"),
            )
        )
        rows = self._base_sales_filter(rows, business_id, start, end)
        rows = (
            rows
            .group_by(extract("hour", Order.created_at))
            .order_by(extract("hour", Order.created_at))
            .all()
        )

        hourly_data = []
        peak_hour = None
        peak_sales = 0.0
        total_sales = 0.0
        total_transactions = 0

        for r in rows:
            sales = round(float(r.sales), 2)
            transactions = int(r.transactions)
            total_sales += sales
            total_transactions += transactions

            entry = {
                "hour": int(r.hour),
                "transactions": transactions,
                "sales": sales,
                "average_transaction_value": round(
                    sales / transactions if transactions > 0 else 0, 2
                ),
            }
            hourly_data.append(entry)

            if sales > peak_sales:
                peak_sales = sales
                peak_hour = entry

        # Day of week breakdown
        dow_rows = (
            self.db.query(
                extract("dow", Order.created_at).label("day_of_week"),
                func.count(Order.id).label("transactions"),
                func.coalesce(func.sum(Order.total), 0).label("sales"),
            )
        )
        dow_rows = self._base_sales_filter(dow_rows, business_id, start, end)
        dow_rows = (
            dow_rows
            .group_by(extract("dow", Order.created_at))
            .order_by(extract("dow", Order.created_at))
            .all()
        )

        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        day_of_week_data = []
        for r in dow_rows:
            dow = int(r.day_of_week)
            day_of_week_data.append({
                "day_of_week": dow,
                "day_name": day_names[dow] if 0 <= dow < 7 else f"Day {dow}",
                "transactions": int(r.transactions),
                "sales": round(float(r.sales), 2),
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_sales": round(total_sales, 2),
            "total_transactions": total_transactions,
            "hourly_breakdown": hourly_data,
            "peak_hour": peak_hour,
            "day_of_week_breakdown": day_of_week_data,
        }

    def get_discount_analysis(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Discount analysis report: totals, by product, by category."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        # Overall discount totals
        totals_row = (
            self.db.query(
                func.coalesce(func.sum(Order.discount_amount), 0).label("total_discounts"),
                func.coalesce(func.sum(Order.total), 0).label("gross_sales"),
                func.count(Order.id).label("total_orders"),
            )
        )
        totals_row = self._base_sales_filter(totals_row, business_id, start, end)
        totals_row = totals_row.one()

        total_discounts = float(totals_row.total_discounts)
        gross_sales = float(totals_row.gross_sales)
        total_orders = int(totals_row.total_orders)

        # Orders with discounts
        discounted_orders_row = (
            self.db.query(func.count(Order.id).label("count"))
        )
        discounted_orders_row = self._base_sales_filter(
            discounted_orders_row, business_id, start, end
        )
        discounted_orders_row = discounted_orders_row.filter(
            Order.discount_amount > 0
        ).one()
        discounted_order_count = int(discounted_orders_row.count)

        discount_percentage = round(
            (total_discounts / gross_sales * 100) if gross_sales > 0 else 0, 1
        )

        # Discount by product (item-level discounts)
        product_rows = (
            self.db.query(
                OrderItem.product_id,
                OrderItem.name.label("product_name"),
                func.coalesce(func.sum(OrderItem.discount_amount), 0).label("discount_total"),
                func.coalesce(func.sum(OrderItem.total), 0).label("revenue"),
                func.count(OrderItem.id).label("item_count"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                OrderItem.deleted_at.is_(None),
                OrderItem.discount_amount > 0,
                Order.created_at >= start,
                Order.created_at < end,
            )
            .group_by(OrderItem.product_id, OrderItem.name)
            .order_by(func.coalesce(func.sum(OrderItem.discount_amount), 0).desc())
            .limit(20)
            .all()
        )

        by_product = []
        for r in product_rows:
            disc = round(float(r.discount_total), 2)
            rev = round(float(r.revenue), 2)
            by_product.append({
                "product_id": str(r.product_id) if r.product_id else None,
                "product_name": r.product_name,
                "discount_total": disc,
                "revenue": rev,
                "discount_percentage": round(
                    (disc / (rev + disc) * 100) if (rev + disc) > 0 else 0, 1
                ),
                "item_count": int(r.item_count),
            })

        # Discount by category
        category_rows = (
            self.db.query(
                ProductCategory.id.label("category_id"),
                ProductCategory.name.label("category_name"),
                func.coalesce(func.sum(OrderItem.discount_amount), 0).label("discount_total"),
                func.coalesce(func.sum(OrderItem.total), 0).label("revenue"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .outerjoin(ProductCategory, ProductCategory.id == Product.category_id)
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                OrderItem.deleted_at.is_(None),
                OrderItem.discount_amount > 0,
                Order.created_at >= start,
                Order.created_at < end,
            )
            .group_by(ProductCategory.id, ProductCategory.name)
            .order_by(func.coalesce(func.sum(OrderItem.discount_amount), 0).desc())
            .all()
        )

        by_category = []
        for r in category_rows:
            disc = round(float(r.discount_total), 2)
            rev = round(float(r.revenue), 2)
            by_category.append({
                "category_id": str(r.category_id) if r.category_id else None,
                "category_name": r.category_name or "Uncategorized",
                "discount_total": disc,
                "revenue": rev,
                "discount_percentage": round(
                    (disc / (rev + disc) * 100) if (rev + disc) > 0 else 0, 1
                ),
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_discounts": round(total_discounts, 2),
            "gross_sales": round(gross_sales, 2),
            "discount_percentage": discount_percentage,
            "total_orders": total_orders,
            "discounted_order_count": discounted_order_count,
            "by_product": by_product,
            "by_category": by_category,
        }

    def get_refund_analysis(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Refund analysis report: totals, by product, patterns."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        # Total refunds
        refund_row = (
            self.db.query(
                func.coalesce(func.sum(Order.total), 0).label("total_refunds"),
                func.count(Order.id).label("refund_count"),
            )
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                Order.status == OrderStatus.REFUNDED,
                Order.created_at >= start,
                Order.created_at < end,
            )
            .one()
        )
        total_refunds = float(refund_row.total_refunds)
        refund_count = int(refund_row.refund_count)

        # Total sales for refund rate
        sales_row = (
            self.db.query(
                func.coalesce(func.sum(Order.total), 0).label("gross_sales"),
                func.count(Order.id).label("total_orders"),
            )
        )
        sales_row = self._base_sales_filter(sales_row, business_id, start, end)
        sales_row = sales_row.one()
        gross_sales = float(sales_row.gross_sales)
        total_orders = int(sales_row.total_orders)

        refund_rate = round(
            (refund_count / total_orders * 100) if total_orders > 0 else 0, 1
        )

        # Refunds by product
        product_rows = (
            self.db.query(
                OrderItem.product_id,
                OrderItem.name.label("product_name"),
                func.coalesce(func.sum(OrderItem.total), 0).label("refund_total"),
                func.coalesce(func.sum(OrderItem.quantity), 0).label("quantity"),
                func.count(func.distinct(Order.id)).label("refund_count"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                OrderItem.deleted_at.is_(None),
                Order.status == OrderStatus.REFUNDED,
                Order.created_at >= start,
                Order.created_at < end,
            )
            .group_by(OrderItem.product_id, OrderItem.name)
            .order_by(func.coalesce(func.sum(OrderItem.total), 0).desc())
            .limit(20)
            .all()
        )

        by_product = []
        for r in product_rows:
            refund_total = round(float(r.refund_total), 2)
            by_product.append({
                "product_id": str(r.product_id) if r.product_id else None,
                "product_name": r.product_name,
                "refund_total": refund_total,
                "quantity": int(r.quantity),
                "refund_count": int(r.refund_count),
                "percentage_of_refunds": round(
                    (refund_total / total_refunds * 100) if total_refunds > 0 else 0, 1
                ),
            })

        # Refund trend by day
        daily_rows = (
            self.db.query(
                func.date(Order.created_at).label("day"),
                func.count(Order.id).label("count"),
                func.coalesce(func.sum(Order.total), 0).label("amount"),
            )
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.OUTBOUND,
                Order.deleted_at.is_(None),
                Order.status == OrderStatus.REFUNDED,
                Order.created_at >= start,
                Order.created_at < end,
            )
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at))
            .all()
        )

        daily_trend = [
            {
                "date": str(r.day),
                "count": int(r.count),
                "amount": round(float(r.amount), 2),
            }
            for r in daily_rows
        ]

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_refunds": round(total_refunds, 2),
            "refund_count": refund_count,
            "gross_sales": round(gross_sales, 2),
            "total_orders": total_orders,
            "refund_rate": refund_rate,
            "by_product": by_product,
            "daily_trend": daily_trend,
        }
