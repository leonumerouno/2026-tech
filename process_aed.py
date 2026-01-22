import pandas as pd
import json

try:
    # Read the XLS file
    df = pd.read_excel(r'c:\Users\ElNum\Desktop\交科赛\drone-rescue\chengdu_aed_locations.xls', engine='xlrd')
    
    # Select relevant columns and rename for frontend convenience
    aed_data = df[['名称', '地址', '经度', '纬度']].rename(columns={
        '名称': 'name',
        '地址': 'address',
        '经度': 'lng',
        '纬度': 'lat'
    })
    
    # Drop rows with missing coordinates
    aed_data = aed_data.dropna(subset=['lat', 'lng'])
    
    # Convert to list of dicts
    data_list = aed_data.to_dict(orient='records')
    
    # Write to JSON file
    output_path = r'c:\Users\ElNum\Desktop\交科赛\drone-rescue\aed_data.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_list, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully wrote {len(data_list)} AED locations to {output_path}")

except Exception as e:
    print(f"Error: {e}")
