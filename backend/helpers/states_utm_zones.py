import json
import os

def get_utm_zone(state: str) -> int:
    """Get the UTM zone number for a given German state."""
    json_path = os.path.join(os.path.dirname(__file__), 'states_UTM_zones.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        utm_zones = json.load(f)
    
    if state not in utm_zones:
        raise ValueError(f"Unknown state: {state}. Valid states are: {', '.join(utm_zones.keys())}")
    
    return utm_zones[state] 