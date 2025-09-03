#!/usr/bin/env python3
"""
Font verification script
This script checks if the font directories in uploads are correctly created.
"""

import os
import sys
import json
from pathlib import Path

def check_uploads_directory(base_path):
    """Check all upload directories for font folders"""
    print(f"Checking uploads directory: {base_path}")
    
    if not os.path.isdir(base_path):
        print(f"Error: Directory not found: {base_path}")
        return False
    
    upload_dirs = []
    
    # Find all upload directories
    for item in os.listdir(base_path):
        upload_path = os.path.join(base_path, item)
        if os.path.isdir(upload_path):
            upload_dirs.append(upload_path)
    
    print(f"Found {len(upload_dirs)} upload directories")
    
    # Check each upload directory for a Fonts folder
    for upload_dir in upload_dirs:
        fonts_dir = os.path.join(upload_dir, "Fonts")
        print(f"\nChecking upload: {os.path.basename(upload_dir)}")
        
        if os.path.isdir(fonts_dir):
            print(f"✅ Fonts directory exists: {fonts_dir}")
            font_files = [f for f in os.listdir(fonts_dir) if os.path.isfile(os.path.join(fonts_dir, f))]
            print(f"   Contains {len(font_files)} font files: {', '.join(font_files) if font_files else 'None'}")
        else:
            print(f"❌ Fonts directory missing: {fonts_dir}")
            # Try to find any font files elsewhere in the upload directory
            found_fonts = []
            for root, _, files in os.walk(upload_dir):
                for file in files:
                    if any(file.lower().endswith(ext) for ext in ['.otf', '.ttf', '.woff', '.woff2']):
                        found_fonts.append(os.path.join(root, file))
            
            if found_fonts:
                print(f"   Found {len(found_fonts)} font files in other locations:")
                for font in found_fonts:
                    print(f"   - {os.path.relpath(font, upload_dir)}")
    
    return True

def main():
    # Get the path to check
    if len(sys.argv) > 1:
        base_path = sys.argv[1]
    else:
        # Default to uploads directory
        base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    
    check_uploads_directory(base_path)

if __name__ == "__main__":
    main()
