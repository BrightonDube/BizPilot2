"""
Fix Session type hints that cause Pydantic validation errors.
Remove type hints from db parameters since Depends() provides the type.
"""

import re
from pathlib import Path

def fix_file(filepath):
    """Remove Session type hint from db parameters."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Pattern to match: db: Session = Depends(get_sync_db)
    # Replace with: db=Depends(get_sync_db)
    content = re.sub(
        r'\bdb:\s*Session\s*=\s*Depends\(get_sync_db\)',
        'db=Depends(get_sync_db)',
        content
    )
    
    # Also fix AsyncSession if present
    content = re.sub(
        r'\bdb:\s*AsyncSession\s*=\s*Depends\(get_db\)',
        'db=Depends(get_db)',
        content
    )
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Fixed {filepath}")
        return True
    return False

def main():
    """Fix all API files."""
    api_dir = Path("app/api")
    files_changed = 0
    
    for filepath in api_dir.glob("*.py"):
        if filepath.name == "__init__.py":
            continue
        
        if fix_file(filepath):
            files_changed += 1
    
    print(f"\n✓ Fixed {files_changed} files")

if __name__ == "__main__":
    main()
