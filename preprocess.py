import os
import json
import sys
from datetime import datetime
from collections import defaultdict

def preprocess():
    input_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "articles.jsonl")
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "data")
    output_file = os.path.join(output_dir, "stats.json")
    
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
        
    print(f"[*] Reading '{input_file}' to generate statistics...")
    
    total_posts = 0
    univ_counts = defaultdict(int)
    hourly_activity = [0] * 24
    
    with open(input_file, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total_posts += 1
            try:
                item = json.loads(line)
                
                # Writer & University info
                writer = item.get("writer") or {}
                univ_name = writer.get("campusFullName")
                if not univ_name:
                    univ_name = "기타/익명"
                
                univ_counts[univ_name] += 1
                
                # Hourly Activity
                created_at = item.get("createdAt", "")
                if len(created_at) >= 19:
                    try:
                        time_part = created_at.split(" ")[1]
                        hour = int(time_part.split(":")[0])
                        if 0 <= hour < 24:
                            hourly_activity[hour] += 1
                    except Exception:
                        pass
                        
            except json.JSONDecodeError as e:
                print(f"[!] JSON parsing error on line {total_posts}: {e}")

    # Compile university list
    universities_list = []
    for name, count in univ_counts.items():
        universities_list.append({
            "name": name,
            "post_count": count
        })
        
    # Sort universities by post_count descending
    universities_list.sort(key=lambda x: x["post_count"], reverse=True)
    
    # Prepare final output structure
    output_data = {
        "total_posts": total_posts,
        "unique_universities": len(universities_list),
        "updated_at": datetime.now().isoformat(),
        "universities": universities_list,
        "hourly_activity": hourly_activity
    }
    
    # Ensure directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    with open(output_file, "w", encoding="utf-8", errors="replace") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        
    print(f"[+] Done! Analyzed {total_posts} posts across {len(universities_list)} universities.")
    print(f"[+] Output stats file saved to '{output_file}'")

if __name__ == "__main__":
    preprocess()
