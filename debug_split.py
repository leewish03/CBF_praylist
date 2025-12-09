import sys
import os

# Mock setup
class PrayerAssignments:
    SPLIT_ASSIGNMENTS = {
        "박민성": ["이소원", "김나경"]
    }

def test_split():
    print("Testing Prayer Splitting Logic")
    
    # Mock Data: 10 prayers
    assignee = "박민성"
    assignee_prayers = [f"Prayer {i+1}" for i in range(10)]
    
    managers = PrayerAssignments.SPLIT_ASSIGNMENTS[assignee]
    
    for manager in managers:
        print(f"\nManager: {manager}")
        
        # Logic copy-pasted from notion_publisher.py
        if hasattr(PrayerAssignments, 'SPLIT_ASSIGNMENTS') and assignee in PrayerAssignments.SPLIT_ASSIGNMENTS:
            split_managers = PrayerAssignments.SPLIT_ASSIGNMENTS[assignee]
            if manager in split_managers:
                total_items = len(assignee_prayers)
                num_splits = len(split_managers)
                split_index = split_managers.index(manager)
                
                base_chunk = total_items // num_splits
                remainder = total_items % num_splits
                
                start_idx = split_index * base_chunk + min(split_index, remainder)
                end_idx = start_idx + base_chunk + (1 if split_index < remainder else 0)
                
                sliced = assignee_prayers[start_idx:end_idx]
                print(f"Assigned Range: {start_idx} to {end_idx}")
                print(f"Items ({len(sliced)}): {sliced}")

test_split()
