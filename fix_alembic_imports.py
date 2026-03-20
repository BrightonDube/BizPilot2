import os
import glob
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We want to move these to immediately after the docstring or first line
    imports_to_move = []
    
    lines = content.split('\n')
    new_lines = []
    
    # Extract imports
    for i, line in enumerate(lines):
        if line.startswith('from alembic') or line.startswith('import sqlalchemy') or line.startswith('from sqlalchemy'):
            imports_to_move.append(line)
        else:
            new_lines.append(line)
            
    # Remove empty lines where imports used to be (consecutive empty lines)
    cleaned_lines = []
    prev_empty = False
    for line in new_lines:
        is_empty = not line.strip()
        if is_empty and prev_empty:
            continue
        cleaned_lines.append(line)
        prev_empty = is_empty
        
    # Find where to insert imports
    insert_idx = 0
    in_docstring = False
    
    for i, line in enumerate(cleaned_lines):
        if i == 0 and (line.startswith('"""') or line.startswith("'''")):
            in_docstring = True
            
        if in_docstring and i > 0 and (line.endswith('"""') or line.endswith("'''")):
            in_docstring = False
            insert_idx = i + 1
            break
            
        if not in_docstring and not line.strip() and i > 0:
            insert_idx = i
            break
            
    if insert_idx == 0:
        # Just put at top if no docstring
        final_lines = imports_to_move + [''] + cleaned_lines
    else:
        final_lines = cleaned_lines[:insert_idx] + [''] + imports_to_move + [''] + cleaned_lines[insert_idx:]
        
    with open(filepath, 'w') as f:
        f.write('\n'.join(final_lines))

for file in glob.glob('backend/alembic/versions/*.py'):
    fix_file(file)

print("Done")
