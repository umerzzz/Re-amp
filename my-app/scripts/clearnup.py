import os
import glob
import shutil

# Define the directory where the files are located (current directory)
directory = "../"

# Define the patterns to match
patterns = [
    os.path.join(directory, "idml-*.json"),
    os.path.join(directory, "page-*.json"),
]

# Loop through each pattern and delete matching files
for pattern in patterns:
    for filepath in glob.glob(pattern):
        try:
            os.remove(filepath)
            print(f"Deleted file: {filepath}")
        except Exception as e:
            print(f"Error deleting file {filepath}: {e}")

# Define the folder to delete
uploads_folder = os.path.join(directory, "uploads")

# Check if the folder exists and delete it
if os.path.isdir(uploads_folder):
    try:
        shutil.rmtree(uploads_folder)
        print(f"Deleted folder: {uploads_folder}")
    except Exception as e:
        print(f"Error deleting folder {uploads_folder}: {e}")
else:
    print("No 'uploads' folder found.")