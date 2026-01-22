import pandas as pd
import json

try:
    # Read the XLS file
    df = pd.read_excel(r'c:\Users\ElNum\Desktop\交科赛\drone-rescue\chengdu_aed_locations.xls', engine='xlrd')
    
    # Print columns to understand structure
    print("Columns:", df.columns.tolist())
    
    # Print first 5 records
    print(df.head().to_json(orient='records', force_ascii=False))
    
    # Save all to a JSON file for the frontend to use
    # We might need to rename columns to standard lat/lng if they aren't already
    # But first let's see the output
except Exception as e:
    print(f"Error: {e}")
