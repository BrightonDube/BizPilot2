import re

with open('backend/app/tests/test_cashup_service.py', 'r') as f:
    content = f.read()

content = content.replace(
    '        if hasattr(obj, "created_at") and obj.created_at is None:\n            obj.created_at = datetime.now(timezone.utc)',
    '        if hasattr(obj, "created_at") and obj.created_at is None:\n            obj.created_at = datetime.now(timezone.utc)\n        if hasattr(obj, "updated_at") and obj.updated_at is None:\n            obj.updated_at = datetime.now(timezone.utc)'
)

with open('backend/app/tests/test_cashup_service.py', 'w') as f:
    f.write(content)
