#!/usr/bin/env python3
"""
Font Processor for IDML uploads
This script scans upload directories for font files and copies them to a 'Fonts' folder.
It supports .otf, .ttf, .woff, .woff2, .eot, and .tiff files.
"""

import os
import shutil
import sys
import argparse
import logging
from pathlib import Path
import re
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Font file extensions to search for
FONT_EXTENSIONS = ['.otf', '.ttf', '.woff', '.woff2', '.eot', '.tiff']

def is_font_file(filename):
    """Check if a file is a font based on its extension."""
    return any(filename.lower().endswith(ext) for ext in FONT_EXTENSIONS)

def scan_for_fonts(directory, max_depth=3):
    """
    Recursively scan directory for font files up to max_depth levels.
    
    Args:
        directory (str): Path to directory to scan
        max_depth (int): Maximum recursion depth
    
    Returns:
        list: List of found font file paths
    """
    font_files = []
    base_path = Path(directory)
    
    # Look specifically for the "FontUploads" directory first
    font_uploads_dir = os.path.join(directory, "FontUploads")
    if os.path.isdir(font_uploads_dir):
        logger.info(f"Found dedicated FontUploads directory: {font_uploads_dir}")
        # If we have a dedicated font uploads directory, prioritize it
        for item in os.listdir(font_uploads_dir):
            item_path = os.path.join(font_uploads_dir, item)
            if os.path.isfile(item_path) and is_font_file(item):
                font_files.append(item_path)
    
    # Then scan the rest of the directory structure
    def scan_directory(current_path, current_depth=0):
        if current_depth > max_depth:
            return
        
        try:
            for item in os.listdir(current_path):
                item_path = os.path.join(current_path, item)
                
                if os.path.isfile(item_path) and is_font_file(item):
                    font_files.append(item_path)
                elif os.path.isdir(item_path):
                    # Look for common font directory names for higher priority
                    if item.lower() in ["fonts", "font", "document fonts"]:
                        logger.info(f"Found potential font directory: {item_path}")
                    
                    # Recursively scan subdirectory
                    scan_directory(item_path, current_depth + 1)
        except (PermissionError, FileNotFoundError) as e:
            logger.warning(f"Error accessing {current_path}: {e}")
    
    # Scan the main directory (skip FontUploads since we already processed it)
    for item in os.listdir(directory):
        if item == "FontUploads":
            continue
            
        item_path = os.path.join(directory, item)
        if os.path.isdir(item_path):
            scan_directory(item_path)
    
    return font_files

def create_fonts_directory(base_directory):
    """Create a Fonts directory if it doesn't exist."""
    fonts_dir = os.path.join(base_directory, "Fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    return fonts_dir

def copy_fonts(font_files, destination_dir, base_dir):
    """
    Copy font files to destination directory, preserving relative paths.
    
    Args:
        font_files: List of font file paths to copy
        destination_dir: Directory to copy fonts to
        base_dir: Base directory to calculate relative paths from
        
    Returns:
        list: List of successfully copied files
    """
    copied_files = []
    for font_file in font_files:
        try:
            # Calculate relative path from base_dir
            rel_path = os.path.relpath(font_file, base_dir)
            
            # If the path contains directory separators (part of a subfolder)
            # preserve only the filename to flatten the structure
            filename = os.path.basename(font_file)
            
            # Create destination path
            destination_path = os.path.join(destination_dir, filename)
            
            # Only copy if the file doesn't already exist in destination
            if not os.path.exists(destination_path):
                shutil.copy2(font_file, destination_path)
                copied_files.append({
                    "source": font_file,
                    "destination": destination_path,
                    "originalName": filename
                })
                logger.info(f"Copied: {filename}")
            else:
                logger.info(f"Skipped (already exists): {filename}")
        except Exception as e:
            logger.error(f"Failed to copy {font_file}: {e}")
    
    return copied_files

def process_upload_directory(upload_dir):
    """
    Process an upload directory to find and organize fonts.
    
    Args:
        upload_dir (str): Path to upload directory
    
    Returns:
        dict: Results of the font processing operation
    """
    logger.info(f"Processing upload directory: {upload_dir}")
    
    # Verify directory exists
    if not os.path.isdir(upload_dir):
        logger.error(f"Directory not found: {upload_dir}")
        return {
            "success": False,
            "error": "Directory not found",
            "directory": upload_dir
        }
    
    # Try to find the correct upload directory (move up until we find "uploads/[timestamp]")
    current_dir = Path(upload_dir)
    upload_root = None
    
    # Look up to 3 levels up to find the uploads/[timestamp] directory
    for _ in range(3):
        if "uploads" in str(current_dir) and re.search(r'uploads[\\/][^\\/:*?"<>|]+$', str(current_dir)):
            upload_root = current_dir
            logger.info(f"Found upload root directory: {upload_root}")
            break
        parent = current_dir.parent
        if parent == current_dir:  # Root directory reached
            break
        current_dir = parent
    
    # If we couldn't find the upload root, use the provided directory
    if not upload_root:
        upload_root = Path(upload_dir)
        logger.warning(f"Could not find upload root, using provided directory: {upload_root}")
    
    # Find font files in the provided directory and subdirectories
    font_files = scan_for_fonts(upload_dir)
    logger.info(f"Found {len(font_files)} font files in {upload_dir}")
    
    if not font_files:
        logger.info("No font files found.")
        
        # Create empty Fonts directory anyway at upload root level
        fonts_dir = create_fonts_directory(str(upload_root))
        logger.info(f"Created empty fonts directory: {fonts_dir}")
        
        return {
            "success": True,
            "fontsFound": 0,
            "fontsCopied": 0,
            "directory": upload_dir,
            "uploadRoot": str(upload_root),
            "fontsDirectory": fonts_dir
        }
    
    # Create fonts directory at the upload root level
    fonts_dir = create_fonts_directory(str(upload_root))
    logger.info(f"Created fonts directory: {fonts_dir}")
    
    # Copy fonts to the fonts directory, preserving original organization
    copied_files = copy_fonts(font_files, fonts_dir, upload_dir)
    
    # Create result summary
    result = {
        "success": True,
        "fontsFound": len(font_files),
        "fontsCopied": len(copied_files),
        "directory": upload_dir,
        "uploadRoot": str(upload_root),
        "fontsDirectory": fonts_dir,
        "copiedFonts": copied_files
    }
    
    # Save summary to a JSON file in the upload directory
    try:
        with open(os.path.join(upload_dir, "font_processing_summary.json"), 'w') as f:
            json.dump(result, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save summary: {e}")
    
    return result

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Process fonts in upload directories')
    parser.add_argument('directory', nargs='?', default=None, 
                        help='Directory to process (default: uses first arg or current directory)')
    args = parser.parse_args()
    
    # Determine directory to process
    directory = args.directory
    
    # If no directory provided, try to use the first command-line argument
    if directory is None and len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
        directory = sys.argv[1]
    
    # If still no directory, use current directory
    if directory is None:
        directory = os.getcwd()
    
    # Process the directory
    result = process_upload_directory(directory)
    
    # Report results
    if result["success"]:
        logger.info(f"Font processing complete. Found: {result['fontsFound']}, Copied: {result['fontsCopied']}")
        return 0
    else:
        logger.error(f"Font processing failed: {result.get('error', 'Unknown error')}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
