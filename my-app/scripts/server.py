import subprocess
import os

# Path to Git Bash executable - configurable via environment variable
git_bash = os.getenv('GIT_BASH_PATH', r"C:\Program Files\Git\bin\bash.exe")

# InDesign Server directory - configurable via environment variable
ids_dir = os.getenv('INDESIGN_SERVER_DIR', r"C:\Program Files\Adobe\Adobe InDesign Server 2025")

# InDesign Server port - configurable via environment variable
server_port = os.getenv('INDESIGN_SERVER_PORT', '1235')

# Command to run in Git Bash and keep window open
command = f'cd "{ids_dir}" && ./InDesignServer.com -console -port {server_port}; echo "Server stopped. Press Enter to exit..."; read'

# Launch external Git Bash with a new console window
subprocess.Popen([git_bash, "--login", "-i", "-c", command], creationflags=subprocess.CREATE_NEW_CONSOLE)