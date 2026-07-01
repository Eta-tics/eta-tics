import os
import sys
import json
import time
import random
import requests
import subprocess
from datetime import datetime

# Load configuration
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
PROGRESS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "progress.json")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        print(f"Error: Configuration file not found at {CONFIG_PATH}")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def get_max_post_id(output_path):
    if not os.path.exists(output_path):
        return 0
    max_id = 0
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                    post_id = item.get("id", 0)
                    if post_id > max_id:
                        max_id = post_id
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"[!] Error scanning max post ID from database: {e}")
    return max_id

def run_preprocess_script():
    try:
        print("[*] Running preprocessor to update statistics dashboard...")
        # Import and run the preprocess function directly to avoid subprocess overhead
        import preprocess
        preprocess.preprocess()
    except Exception as e:
        print(f"[!] Preprocessing failed: {e}")

def sync_cycle(config, output_path):
    api_url = config.get("api_url")
    board_id = config.get("board_id")
    headers = config.get("headers", {})
    delay_min = config.get("delay_min", 1.5)
    delay_max = config.get("delay_max", 3.5)
    max_retries = config.get("max_retries", 5)
    backoff_factor = config.get("backoff_factor", 2.0)
    
    max_id = get_max_post_id(output_path)
    print(f"[*] Current maximum Post ID in local database: {max_id}")
    
    session = requests.Session()
    cursor = None
    new_articles = []
    stop_sync = False
    page_count = 0
    
    while not stop_sync:
        page_count += 1
        payload = {
            "boardId": board_id
        }
        if cursor is not None:
            payload["cursor"] = cursor
            
        print(f"[*] Fetching page {page_count} (Cursor: {cursor if cursor is not None else 'Newest'})...")
        
        # Request with retry and backoff
        response_data = None
        attempt = 0
        while attempt < max_retries:
            try:
                response = session.post(
                    api_url, 
                    headers=headers, 
                    json=payload, 
                    timeout=15
                )
                if response.status_code != 200:
                    print(f"[!] HTTP Error {response.status_code} on attempt {attempt + 1}")
                    raise requests.HTTPError(response=response)
                response_data = response.json()
                break
            except (requests.RequestException, ValueError) as e:
                attempt += 1
                if attempt >= max_retries:
                    print(f"[-] Max retries reached during sync. Aborting this cycle.")
                    return False
                sleep_time = (backoff_factor ** attempt) + random.uniform(0.5, 1.5)
                print(f"[!] API error: {e}. Retrying in {sleep_time:.2f} seconds...")
                time.sleep(sleep_time)
                
        if not response_data:
            print("[-] Received empty response. Aborting cycle.")
            return False
            
        result = response_data.get("result", {})
        if not isinstance(result, dict):
            print(f"[-] Unexpected response format: {result}")
            return False
            
        items = result.get("items", [])
        next_cursor = result.get("nextCursor")
        
        if not items:
            print("[*] No articles returned on this page. Sync finished.")
            break
            
        # Check items for overlap with existing data
        page_new_articles = []
        for item in items:
            item_id = item.get("id", 0)
            if max_id > 0 and item_id <= max_id:
                print(f"[*] Reached already crawled article (ID: {item_id}). Stopping fetch.")
                stop_sync = True
                break
            page_new_articles.append(item)
            
        new_articles.extend(page_new_articles)
        print(f"[+] Found {len(page_new_articles)} new articles on page {page_count}.")
        
        if stop_sync:
            break
            
        if not next_cursor or next_cursor == cursor:
            print("[*] Reached the end of history during sync.")
            break
            
        cursor = next_cursor
        # Random sleep delay
        sleep_delay = random.uniform(delay_min, delay_max)
        time.sleep(sleep_delay)
        
    if new_articles:
        # Sort new articles in ascending order of ID so they append in chronological order
        new_articles.sort(key=lambda x: x.get("id", 0))
        
        # Save to database
        with open(output_path, "a", encoding="utf-8") as f:
            for item in new_articles:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
                
        print(f"[+] Successfully synced and appended {len(new_articles)} new articles.")
        
        # Save progress details
        last_item = new_articles[-1]
        progress_data = {
            "boardId": board_id,
            "lastSyncedPostId": last_item.get("id"),
            "lastSyncedTime": datetime.now().isoformat(),
            "new_synced_count": len(new_articles)
        }
        with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
            json.dump(progress_data, f, indent=2, ensure_ascii=False)
            
        # Trigger preprocessor to update the dashboard
        run_preprocess_script()
    else:
        print("[*] Database is already up-to-date. No new articles to sync.")
        
    return True

def main():
    config = load_config()
    output_filename = config.get("output_file", "articles.jsonl")
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), output_filename)
    
    loop_mode = config.get("loop_mode", False) or ("--loop" in sys.argv)
    interval_sec = config.get("monitor_interval_sec", 300)
    
    print("[*] Everytime Sync Crawler Initiated.")
    
    if loop_mode:
        print(f"[*] Running in DAEMON / LOOP mode. Checking for new articles every {interval_sec} seconds...")
        try:
            while True:
                print(f"\n[*] Starting sync cycle at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                sync_cycle(config, output_path)
                print(f"[*] Sleep for {interval_sec} seconds...")
                time.sleep(interval_sec)
        except KeyboardInterrupt:
            print("\n[!] Sync Crawler loop stopped by user. Exiting.")
            sys.exit(0)
    else:
        print("[*] Running in SINGLE-RUN mode.")
        sync_cycle(config, output_path)
        print("[*] Sync Crawler completed. Exiting.")

if __name__ == "__main__":
    main()
