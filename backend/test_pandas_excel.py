import pandas as pd
import io

try:
    output = io.BytesIO()
    df = pd.DataFrame([{'a': 1, 'b': 2}])
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Summary', index=False)
    print("Excel generation successful")
except Exception as e:
    print(f"Excel generation failed: {e}")
    import traceback
    traceback.print_exc()
