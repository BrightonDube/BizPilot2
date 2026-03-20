import os

filepath = 'backend/app/tests/test_two_factor.py'
with open(filepath, 'r') as f:
    content = f.read()

content = content.replace('business_id = uuid4()\n    user = MagicMock(spec=User)', 'user = MagicMock(spec=User)')

with open(filepath, 'w') as f:
    f.write(content)
