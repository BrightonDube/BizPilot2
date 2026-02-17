"""Inventory report service for stock analytics."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.inventory import InventoryTransaction
from app.models.order import Order, OrderItem, OrderDirection
from app.models.product import Product, ProductCategory
from app.models.supplier import Supplier


class InventoryReportService:
    """Service for generating inventory reports."""

    def __init__(self, db: Session):
        self.db = db

    def get_stock_levels(
        self,
        business_id,
        category_id: Optional[str] = None,
        low_stock_only: bool = False,
        out_of_stock_only: bool = False,
    ) -> dict:
        """Current stock levels by product with category and low/out-of-stock flags."""
        query = (
            self.db.query(
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                Product.sku,
                Product.cost_price,
                Product.selling_price,
                Product.quantity.label("current_stock"),
                Product.low_stock_threshold.label("reorder_level"),
                ProductCategory.id.label("category_id"),
                ProductCategory.name.label("category_name"),
            )
            .outerjoin(ProductCategory, ProductCategory.id == Product.category_id)
            .filter(
                Product.business_id == str(business_id),
                Product.deleted_at.is_(None),
            )
        )

        if category_id:
            query = query.filter(Product.category_id == category_id)

        if out_of_stock_only:
            query = query.filter(Product.quantity <= 0)
        elif low_stock_only:
            query = query.filter(Product.quantity <= Product.low_stock_threshold)

        rows = query.order_by(Product.name).all()

        total_stock_value = Decimal("0")
        total_retail_value = Decimal("0")
        low_stock_count = 0
        out_of_stock_count = 0

        items = []
        for r in rows:
            current_stock = r.current_stock or 0
            cost_price = r.cost_price or Decimal("0")
            selling_price = r.selling_price or Decimal("0")
            reorder_level = r.reorder_level or 0

            stock_value = Decimal(str(current_stock)) * cost_price
            retail_value = Decimal(str(current_stock)) * selling_price
            is_low_stock = current_stock > 0 and current_stock <= reorder_level
            is_out_of_stock = current_stock <= 0

            if is_low_stock:
                low_stock_count += 1
            if is_out_of_stock:
                out_of_stock_count += 1

            total_stock_value += stock_value
            total_retail_value += retail_value

            items.append({
                "product_id": str(r.product_id),
                "product_name": r.product_name,
                "sku": r.sku,
                "category_id": str(r.category_id) if r.category_id else None,
                "category_name": r.category_name or "Uncategorized",
                "current_stock": current_stock,
                "reorder_level": reorder_level,
                "cost_price": round(float(cost_price), 2),
                "selling_price": round(float(selling_price), 2),
                "stock_value": round(float(stock_value), 2),
                "is_low_stock": is_low_stock,
                "is_out_of_stock": is_out_of_stock,
            })

        return {
            "total_products": len(items),
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "total_stock_value": round(float(total_stock_value), 2),
            "total_retail_value": round(float(total_retail_value), 2),
            "items": items,
        }

    def get_stock_movements(
        self,
        business_id,
        start_date: date,
        end_date: date,
        product_id: Optional[str] = None,
    ) -> dict:
        """Stock movement report showing ins, outs, and adjustments."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        query = (
            self.db.query(
                InventoryTransaction.transaction_type,
                func.count(InventoryTransaction.id).label("transaction_count"),
                func.coalesce(
                    func.sum(
                        case(
                            (InventoryTransaction.quantity_change > 0, InventoryTransaction.quantity_change),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_in"),
                func.coalesce(
                    func.sum(
                        case(
                            (InventoryTransaction.quantity_change < 0, func.abs(InventoryTransaction.quantity_change)),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_out"),
                func.coalesce(func.sum(InventoryTransaction.quantity_change), 0).label("net_change"),
            )
            .filter(
                InventoryTransaction.business_id == str(business_id),
                InventoryTransaction.deleted_at.is_(None),
                InventoryTransaction.created_at >= start,
                InventoryTransaction.created_at < end,
            )
        )

        if product_id:
            query = query.filter(InventoryTransaction.product_id == product_id)

        summary_rows = (
            query
            .group_by(InventoryTransaction.transaction_type)
            .order_by(InventoryTransaction.transaction_type)
            .all()
        )

        movement_summary = []
        grand_total_in = 0
        grand_total_out = 0
        grand_net = 0
        for r in summary_rows:
            total_in = int(r.total_in)
            total_out = int(r.total_out)
            net = int(r.net_change)
            grand_total_in += total_in
            grand_total_out += total_out
            grand_net += net
            movement_summary.append({
                "transaction_type": r.transaction_type.value if hasattr(r.transaction_type, "value") else str(r.transaction_type),
                "transaction_count": int(r.transaction_count),
                "total_in": total_in,
                "total_out": total_out,
                "net_change": net,
            })

        # Per-product breakdown
        product_query = (
            self.db.query(
                InventoryTransaction.product_id,
                Product.name.label("product_name"),
                Product.sku,
                func.count(InventoryTransaction.id).label("transaction_count"),
                func.coalesce(func.sum(InventoryTransaction.quantity_change), 0).label("net_change"),
            )
            .join(Product, Product.id == InventoryTransaction.product_id)
            .filter(
                InventoryTransaction.business_id == str(business_id),
                InventoryTransaction.deleted_at.is_(None),
                InventoryTransaction.created_at >= start,
                InventoryTransaction.created_at < end,
            )
        )

        if product_id:
            product_query = product_query.filter(InventoryTransaction.product_id == product_id)

        product_rows = (
            product_query
            .group_by(InventoryTransaction.product_id, Product.name, Product.sku)
            .order_by(func.count(InventoryTransaction.id).desc())
            .all()
        )

        product_movements = []
        for r in product_rows:
            product_movements.append({
                "product_id": str(r.product_id),
                "product_name": r.product_name,
                "sku": r.sku,
                "transaction_count": int(r.transaction_count),
                "net_change": int(r.net_change),
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_in": grand_total_in,
            "total_out": grand_total_out,
            "net_change": grand_net,
            "movement_summary": movement_summary,
            "product_movements": product_movements,
        }

    def get_valuation(self, business_id, method: str = "average") -> dict:
        """Inventory valuation report grouped by category."""
        rows = (
            self.db.query(
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                Product.sku,
                Product.quantity,
                Product.cost_price,
                Product.selling_price,
                ProductCategory.id.label("category_id"),
                ProductCategory.name.label("category_name"),
            )
            .outerjoin(ProductCategory, ProductCategory.id == Product.category_id)
            .filter(
                Product.business_id == str(business_id),
                Product.deleted_at.is_(None),
                Product.quantity > 0,
            )
            .order_by(ProductCategory.name, Product.name)
            .all()
        )

        categories: dict = {}
        total_cost_value = Decimal("0")
        total_retail_value = Decimal("0")
        total_units = 0

        for r in rows:
            qty = r.quantity or 0
            cost = r.cost_price or Decimal("0")
            selling = r.selling_price or Decimal("0")
            cost_value = Decimal(str(qty)) * cost
            retail_value = Decimal(str(qty)) * selling

            total_cost_value += cost_value
            total_retail_value += retail_value
            total_units += qty

            cat_key = str(r.category_id) if r.category_id else "uncategorized"
            cat_name = r.category_name or "Uncategorized"

            if cat_key not in categories:
                categories[cat_key] = {
                    "category_id": str(r.category_id) if r.category_id else None,
                    "category_name": cat_name,
                    "total_units": 0,
                    "cost_value": Decimal("0"),
                    "retail_value": Decimal("0"),
                    "products": [],
                }

            categories[cat_key]["total_units"] += qty
            categories[cat_key]["cost_value"] += cost_value
            categories[cat_key]["retail_value"] += retail_value
            categories[cat_key]["products"].append({
                "product_id": str(r.product_id),
                "product_name": r.product_name,
                "sku": r.sku,
                "quantity": qty,
                "unit_cost": round(float(cost), 2),
                "cost_value": round(float(cost_value), 2),
                "retail_value": round(float(retail_value), 2),
            })

        category_list = []
        for cat in categories.values():
            category_list.append({
                "category_id": cat["category_id"],
                "category_name": cat["category_name"],
                "total_units": cat["total_units"],
                "cost_value": round(float(cat["cost_value"]), 2),
                "retail_value": round(float(cat["retail_value"]), 2),
                "product_count": len(cat["products"]),
                "products": cat["products"],
            })

        return {
            "method": method,
            "total_units": total_units,
            "total_cost_value": round(float(total_cost_value), 2),
            "total_retail_value": round(float(total_retail_value), 2),
            "potential_profit": round(float(total_retail_value - total_cost_value), 2),
            "category_count": len(category_list),
            "categories": category_list,
        }

    def get_turnover_analysis(
        self, business_id, start_date: date, end_date: date
    ) -> dict:
        """Inventory turnover analysis with fast/slow/dead stock classification."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)
        days_in_period = max((end - start).days, 1)

        # Get COGS per product from outbound orders (sales)
        cogs_rows = (
            self.db.query(
                OrderItem.product_id,
                func.coalesce(func.sum(OrderItem.quantity), 0).label("units_sold"),
                func.coalesce(func.sum(OrderItem.total), 0).label("revenue"),
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
            .group_by(OrderItem.product_id)
            .all()
        )

        sales_map = {}
        for r in cogs_rows:
            if r.product_id:
                sales_map[str(r.product_id)] = {
                    "units_sold": int(r.units_sold),
                    "revenue": float(r.revenue),
                }

        # Get current inventory levels
        products = (
            self.db.query(
                Product.id,
                Product.name,
                Product.sku,
                Product.quantity,
                Product.cost_price,
                Product.selling_price,
            )
            .filter(
                Product.business_id == str(business_id),
                Product.deleted_at.is_(None),
            )
            .all()
        )

        fast_moving = []
        slow_moving = []
        dead_stock = []
        total_cogs = Decimal("0")
        total_inventory_value = Decimal("0")

        for p in products:
            pid = str(p.id)
            qty = p.quantity or 0
            cost = p.cost_price or Decimal("0")
            inv_value = Decimal(str(qty)) * cost
            total_inventory_value += inv_value

            sales = sales_map.get(pid, {"units_sold": 0, "revenue": 0.0})
            units_sold = sales["units_sold"]
            cogs = Decimal(str(units_sold)) * cost
            total_cogs += cogs

            avg_inventory = Decimal(str(qty))
            turnover_ratio = (
                float(cogs / avg_inventory) if avg_inventory > 0 else 0.0
            )
            days_of_inventory = (
                round(float(avg_inventory) / (float(cogs) / days_in_period), 1)
                if float(cogs) > 0
                else 0.0
            )

            entry = {
                "product_id": pid,
                "product_name": p.name,
                "sku": p.sku,
                "current_stock": qty,
                "units_sold": units_sold,
                "inventory_value": round(float(inv_value), 2),
                "cogs": round(float(cogs), 2),
                "turnover_ratio": round(turnover_ratio, 2),
                "days_of_inventory": days_of_inventory,
            }

            if units_sold == 0:
                entry["classification"] = "dead_stock"
                dead_stock.append(entry)
            elif turnover_ratio >= 2.0:
                entry["classification"] = "fast_moving"
                fast_moving.append(entry)
            else:
                entry["classification"] = "slow_moving"
                slow_moving.append(entry)

        avg_inv = float(total_inventory_value)
        overall_turnover = (
            round(float(total_cogs) / avg_inv, 2) if avg_inv > 0 else 0.0
        )
        overall_days = (
            round(avg_inv / (float(total_cogs) / days_in_period), 1)
            if float(total_cogs) > 0
            else 0.0
        )

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "days_in_period": days_in_period,
            "overall_turnover_ratio": overall_turnover,
            "overall_days_of_inventory": overall_days,
            "total_cogs": round(float(total_cogs), 2),
            "total_inventory_value": round(float(total_inventory_value), 2),
            "fast_moving_count": len(fast_moving),
            "slow_moving_count": len(slow_moving),
            "dead_stock_count": len(dead_stock),
            "fast_moving": sorted(fast_moving, key=lambda x: x["turnover_ratio"], reverse=True),
            "slow_moving": sorted(slow_moving, key=lambda x: x["turnover_ratio"], reverse=True),
            "dead_stock": dead_stock,
        }

    def get_supplier_performance(
        self, business_id, start_date: date, end_date: date
    ) -> dict:
        """Supplier performance report based on inbound (purchase) orders."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        rows = (
            self.db.query(
                Order.supplier_id,
                Supplier.name.label("supplier_name"),
                func.count(Order.id).label("order_count"),
                func.coalesce(func.sum(Order.total), 0).label("total_purchases"),
                func.coalesce(func.sum(Order.subtotal), 0).label("subtotal"),
                func.coalesce(func.sum(Order.tax_amount), 0).label("tax"),
                func.min(Order.created_at).label("first_order"),
                func.max(Order.created_at).label("last_order"),
            )
            .outerjoin(Supplier, Supplier.id == Order.supplier_id)
            .filter(
                Order.business_id == str(business_id),
                Order.direction == OrderDirection.INBOUND,
                Order.deleted_at.is_(None),
                Order.created_at >= start,
                Order.created_at < end,
            )
            .group_by(Order.supplier_id, Supplier.name)
            .order_by(func.coalesce(func.sum(Order.total), 0).desc())
            .all()
        )

        total_purchases = sum(float(r.total_purchases) for r in rows) if rows else 0.0
        total_orders = sum(int(r.order_count) for r in rows) if rows else 0

        suppliers = []
        for r in rows:
            purchases = round(float(r.total_purchases), 2)
            order_count = int(r.order_count)
            avg_order = round(purchases / order_count, 2) if order_count > 0 else 0.0

            suppliers.append({
                "supplier_id": str(r.supplier_id) if r.supplier_id else None,
                "supplier_name": r.supplier_name or "Unknown Supplier",
                "order_count": order_count,
                "total_purchases": purchases,
                "subtotal": round(float(r.subtotal), 2),
                "tax": round(float(r.tax), 2),
                "average_order_value": avg_order,
                "purchase_percentage": round(
                    (purchases / total_purchases * 100) if total_purchases > 0 else 0, 1
                ),
                "first_order": r.first_order.isoformat() if r.first_order else None,
                "last_order": r.last_order.isoformat() if r.last_order else None,
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_purchases": round(total_purchases, 2),
            "total_orders": total_orders,
            "supplier_count": len(suppliers),
            "suppliers": suppliers,
        }
