import re

with open('backend/app/tests/test_cashup_service.py', 'r') as f:
    content = f.read()

content = content.replace(
    '        total_sales=Decimal("100.00"),\n        shift_id=SHIFT_ID,\n        generated_at=NOW,\n        created_at=NOW,\n        updated_at=NOW,\n    )',
    '        total_sales=Decimal("100.00"),\n        total_tips=Decimal("0.00"),\n        cash_collected=Decimal("0.00"),\n        card_collected=Decimal("0.00"),\n        cover_count=0,\n        tables_served=0,\n        shift_id=SHIFT_ID,\n        generated_at=NOW,\n        created_at=NOW,\n        updated_at=NOW,\n    )'
)

content = content.replace(
    '        total_sales=Decimal("100.00"),\n        generated_at=NOW,\n        created_at=NOW,\n        updated_at=NOW,\n    )',
    '        total_sales=Decimal("100.00"),\n        total_tips=Decimal("0.00"),\n        cash_collected=Decimal("0.00"),\n        card_collected=Decimal("0.00"),\n        cover_count=0,\n        tables_served=0,\n        generated_at=NOW,\n        created_at=NOW,\n        updated_at=NOW,\n    )'
)

with open('backend/app/tests/test_cashup_service.py', 'w') as f:
    f.write(content)
