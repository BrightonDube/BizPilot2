"""
Revert the incorrect sync database changes.
This script will change all endpoints back to using get_db() instead of get_sync_db().
"""

import re
from pathlib import Path

# Files to process
API_DIR = Path("app/api")

def revert_file(filepath):
    """Revert get_sync_db back to get_db in a file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Replace get_sync_db with get_db in Depends()
    content = content.replace('Depends(get_sync_db)', 'Depends(get_db)')
    
    # Replace Session type hint with AsyncSession for async functions
    # This is a simple replacement - may need manual review
    content = re.sub(
        r'async def\s+\w+\([^)]*db:\s*Session\s*=\s*Depends\(get_db\)',
        lambda m: m.group(0).replace('db: Session', 'db: AsyncSession'),
        content
    )
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Reverted {filepath}")
        return True
    return False

def main():
    """Main function to revert all files."""
    files_changed = 0
    
    # Process all Python files in app/api/
    for filepath in API_DIR.glob("*.py"):
        if filepath.name == "__init__.py":
            continue
        
        if revert_file(filepath):
            files_changed += 1
    
    print(f"\n✓ Reverted {files_changed} files")
    print("\nNOTE: You may need to manually review and fix:")
    print("1. Import statements (AsyncSession vs Session)")
    print("2. Service classes that expect sync sessions")
    print("3. Any def functions that should be async def")

if __name__ == "__main__":
    main()
