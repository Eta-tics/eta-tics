import os
import sys
import subprocess
from datetime import datetime

def run_cmd(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=True)
        return result.stdout.strip(), True
    except subprocess.CalledProcessError as e:
        combined_output = (e.stdout or "") + "\n" + (e.stderr or "")
        return combined_output.strip(), False

def main():
    print("[*] Deploying Everytime Stats Dashboard to GitHub Pages...")
    
    # 1. Check if git is installed
    _, git_installed = run_cmd(["git", "--version"])
    if not git_installed:
        print("[-] Error: Git is not installed or not in system PATH.")
        sys.exit(1)
        
    # 2. Check if .git directory exists, initialize if not
    if not os.path.exists(".git"):
        print("[*] Initializing git repository...")
        stdout, ok = run_cmd(["git", "init"])
        if not ok:
            print(f"[-] Failed to initialize git repository: {stdout}")
            sys.exit(1)
        print("[+] Git repository initialized.")

    # 3. Create .gitignore if not exists (double check)
    gitignore_path = ".gitignore"
    if not os.path.exists(gitignore_path):
        with open(gitignore_path, "w", encoding="utf-8") as f:
            f.write("config.json\nprogress.json\narticles.jsonl\n__pycache__/\n.DS_Store\n")
        print("[+] Created default .gitignore file.")

    # 4. Stage files
    print("[*] Staging files...")
    # Add files selectively to keep repository clean, or git add -A
    _, ok1 = run_cmd(["git", "add", "docs/"])
    _, ok2 = run_cmd(["git", "add", ".gitignore"])
    _, ok3 = run_cmd(["git", "add", "preprocess.py"])
    _, ok4 = run_cmd(["git", "add", "crawler.py"])
    _, ok5 = run_cmd(["git", "add", "deploy.py"])
    
    if not (ok1 and ok2 and ok3 and ok4 and ok5):
        print("[-] Error occurred while staging files. Trying general add...")
        _, ok_all = run_cmd(["git", "add", "."])
        if not ok_all:
            print("[-] Failed to stage files.")
            sys.exit(1)
            
    print("[+] Files staged successfully.")

    # 5. Commit files
    commit_msg = f"Deploy update: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    print(f"[*] Committing changes with message: '{commit_msg}'...")
    stdout, ok = run_cmd(["git", "commit", "-m", commit_msg])
    if not ok:
        # Check if it was just "nothing to commit" or "nothing added to commit"
        stdout_lower = stdout.lower()
        if "nothing to commit" in stdout_lower or "nothing added" in stdout_lower or "clean" in stdout_lower:
            print("[*] No changes detected. Nothing to commit.")
        else:
            print(f"[-] Commit failed: {stdout}")
            sys.exit(1)
    else:
        print("[+] Changes committed successfully.")

    # 6. Ensure branch name is 'main'
    run_cmd(["git", "branch", "-M", "main"])

    # 7. Check for remote origin
    stdout, origin_exists = run_cmd(["git", "remote", "get-url", "origin"])
    if not origin_exists:
        print("\n[!] WARNING: Remote repository 'origin' is not configured.")
        print("    To upload your page, first create a new repository on GitHub.")
        print("    Then, link it by running the following command in this directory:")
        print("    \n    git remote add origin <your-github-repo-url>\n")
        print("    After linking the remote, run 'python deploy.py' again.")
        sys.exit(0)
        
    print(f"[*] Remote origin detected: {stdout}")
    print("[*] Pushing to GitHub (main branch)...")
    
    # Run push
    push_out, push_ok = run_cmd(["git", "push", "-u", "origin", "main"])
    if not push_ok:
        # If push failed, maybe they haven't set push permissions or branch is out of sync.
        # Let's print the error.
        print(f"[-] Push failed. Error log:")
        print(push_out)
        print("\n[!] Troubleshooting Tip:")
        print("    - If it's a new repo, verify you have write permissions.")
        print("    - If there are remote changes, try pulling first: git pull origin main --rebase")
        sys.exit(1)
        
    print("\n[+] SUCCESS: Deployment files pushed to GitHub repository!")
    print("[*] GitHub Pages Setup Reminder:")
    print("    1. Open your repository on github.com")
    # Using markdown link in CLI output isn't fully clickable, but standard text is clean:
    print("    2. Navigate to 'Settings' -> 'Pages'")
    print("    3. Set Build and deployment -> Source: 'Deploy from a branch'")
    print("    4. Set Branch: 'main' and Folder: '/docs'")
    print("    5. Save and wait a few minutes for deployment.")

if __name__ == "__main__":
    main()
