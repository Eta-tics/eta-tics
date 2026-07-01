import os
import json
import sys
from datetime import datetime
from collections import Counter, defaultdict

def preprocess():
    input_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "articles.jsonl")
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "data")
    output_file = os.path.join(output_dir, "stats.json")
    
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
        
    print(f"[*] Reading '{input_file}' to generate statistics...")
    
    total_posts = 0
    total_likes = 0
    total_comments = 0
    
    # Aggregation stores
    univ_stats = defaultdict(lambda: {"post_count": 0, "total_likes": 0, "total_comments": 0})
    hourly_activity = [0] * 24
    all_articles = []
    
    with open(input_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total_posts += 1
            try:
                item = json.loads(line)
                all_articles.append(item)
                
                # Engagement
                likes = item.get("posvote", 0)
                comments = item.get("commentCount", 0)
                total_likes += likes
                total_comments += comments
                
                # Writer & University info
                writer = item.get("writer") or {}
                univ_name = writer.get("campusFullName")
                if not univ_name:
                    univ_name = "기타/익명"
                
                univ_stats[univ_name]["post_count"] += 1
                univ_stats[univ_name]["total_likes"] += likes
                univ_stats[univ_name]["total_comments"] += comments
                
                # Hourly Activity
                created_at = item.get("createdAt", "")
                # e.g., "2026-07-01 23:21:44"
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
    for name, stats in univ_stats.items():
        count = stats["post_count"]
        avg_likes = round(stats["total_likes"] / count, 2) if count > 0 else 0
        avg_comments = round(stats["total_comments"] / count, 2) if count > 0 else 0
        
        universities_list.append({
            "name": name,
            "post_count": count,
            "total_likes": stats["total_likes"],
            "total_comments": stats["total_comments"],
            "avg_likes": avg_likes,
            "avg_comments": avg_comments
        })
        
    # Sort universities by post_count descending
    universities_list.sort(key=lambda x: x["post_count"], reverse=True)
    
    # Get top 5 highlights (most liked posts)
    # Sort by posvote desc, then commentCount desc, then id desc
    sorted_highlights = sorted(all_articles, key=lambda x: (x.get("posvote", 0), x.get("commentCount", 0), x.get("id", 0)), reverse=True)
    highlights = []
    for item in sorted_highlights[:10]: # Pick top 10 to filter out empty titles or just show the best
        writer = item.get("writer") or {}
        highlights.append({
            "id": item.get("id"),
            "title": item.get("title") or "제목 없음",
            "textPreview": item.get("textPreview") or "",
            "posvote": item.get("posvote", 0),
            "commentCount": item.get("commentCount", 0),
            "createdAt": item.get("createdAt"),
            "writer": {
                "displayName": writer.get("displayName") or "익명",
                "campusFullName": writer.get("campusFullName") or "기타/익명",
                "picture": writer.get("picture") or "https://cf-fpi.everytime.kr/0.png"
            }
        })

    # Prepare final output structure
    output_data = {
        "total_posts": total_posts,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "unique_universities": len(universities_list),
        "updated_at": datetime.now().isoformat(),
        "universities": universities_list,
        "hourly_activity": hourly_activity,
        "highlights": highlights
    }
    
    # Ensure directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        
    print(f"[+] Done! Analyzed {total_posts} posts across {len(universities_list)} universities.")
    print(f"[+] Output stats file saved to '{output_file}'")

if __name__ == "__main__":
    preprocess()
