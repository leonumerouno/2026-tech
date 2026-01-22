import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ElNum\Desktop\交科赛\drone-rescue\无人机站点（假设）.xlsx')
    print(df.to_json(orient='records', force_ascii=False))
except Exception as e:
    print(f"Error: {e}")
