# Re-amp: IDML Document Viewer & Processor

Re-amp is a web application for uploading, processing, and viewing Adobe InDesign Markup Language (IDML) documents directly in the browser. The application parses IDML files, extracts their content, and renders them with high fidelity, including proper font handling and styling.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Project Flow](#project-flow)
- [Directory Structure](#directory-structure)
- [Key Components](#key-components)
- [Font Processing System](#font-processing-system)
- [API Endpoints](#api-endpoints)
- [Installation & Setup](#installation--setup)
- [Development](#development)
- [Deployment](#deployment)

## Project Overview

Re-amp provides a user-friendly web interface for uploading IDML files (either directly or within folders), processing them, and viewing the rendered content in the browser. It handles complex IDML structures, including text frames, rectangles, ovals, polygons, and other InDesign elements.

A key feature of the application is its ability to detect, process, and apply the appropriate fonts from uploaded packages, ensuring that text is displayed with the correct typography as intended in the original design.

## Architecture

Re-amp is built on the following technology stack:

- **Frontend**: React.js for UI components
- **Framework**: Next.js for server-side rendering and API routes
- **Backend Processing**: Node.js for handling uploads and file processing
- **Font Processing**: Python scripts for font detection and management
- **File Handling**: Uses formidable for file uploads and unzipper for archive extraction
- **XML Processing**: Uses fast-xml-parser for parsing IDML XML structures
- **Styling**: CSS Modules for component styling

The architecture follows a modular approach with clear separation of concerns:

1. **Upload Handling**: Processes uploaded files, extracts IDML content, and stores in organized structure
2. **IDML Parsing**: Converts IDML XML into a structured JSON representation
3. **Font Processing**: Detects, extracts, and prepares fonts for use in rendering
4. **Rendering**: Converts parsed IDML data into visual HTML/CSS representation
5. **Font Integration**: Dynamically loads and applies fonts to rendered elements

## Core Features

- Upload IDML files or folders containing IDML files
- Parse and extract content from IDML packages
- Detect and load fonts from uploaded packages
- High-fidelity rendering of InDesign layouts
- Support for text frames, shapes, and complex styling
- Preview of loaded fonts
- Clean handling of font names with special characters
- Proper text rendering with correct typography

## Project Flow

1. **Upload Stage**:

   - User uploads IDML files or folders through drag-and-drop or file selector
   - Files are processed server-side, extracted, and stored in a timestamped upload directory
   - Font files are detected and copied to a dedicated Fonts directory
   - IDML content is parsed and converted to a structured JSON format

2. **Processing Stage**:

   - IDML XML files are parsed into a unified JSON structure
   - Elements (text frames, shapes, etc.) are identified and processed
   - Style definitions are resolved and linked to content
   - Font references are identified and prepared for loading

3. **Viewing Stage**:
   - User is redirected to the viewer page for their upload
   - Custom fonts are loaded from the Fonts directory
   - IDML content is rendered as HTML/CSS/SVG
   - Elements are positioned according to InDesign coordinates
   - Fonts and styles are applied to match original design

## Directory Structure

```
/
├── app/                     # Next.js app directory
│   ├── components/          # React components
│   │   ├── IDMLViewer.js    # Main IDML rendering component
│   │   └── FontPreview.js   # Font preview component
│   ├── lib/                 # Core application libraries
│   │   ├── idml/            # Modularized IDML parsing code
│   │   │   ├── index.js     # Main parser coordination
│   │   │   ├── ovalParser.js # Oval element parser
│   │   │   ├── polygonParser.js # Polygon element parser
│   │   │   ├── rectangleParser.js # Rectangle element parser
│   │   │   ├── storyParser.js # Text story parser
│   │   │   ├── textFrameParser.js # Text frame parser
│   │   │   └── utils.js    # Utility functions
│   │   ├── idmlParser.js   # Main parser (compatibility wrapper)
│   │   ├── idmlRenderUtils.js # Rendering utilities
│   │   └── indesignSoap.js # InDesign server integration
│   ├── view/                # Upload viewer pages
│   │   └── [uploadId]/      # Dynamic upload viewer route
│   │       └── page.js      # Upload viewer page component
│   ├── layout.js            # Root layout component
│   └── page.js              # Home/upload page
├── pages/                   # Next.js pages directory (for API routes)
│   └── api/                 # API endpoints
│       ├── fonts.js         # Font listing API
│       ├── serve-font.js    # Font serving API
│       └── upload.js        # File upload API
├── public/                  # Static assets
│   └── ...                  # Icons and static resources
├── scripts/                 # Utility scripts
│   ├── cleanup.py           # Cleanup script for old uploads
│   ├── font_processor.py    # Font detection and copying script
│   └── verify_fonts.py      # Font verification script
├── uploads/                 # Upload storage directory
│   └── [timestamp]/         # Timestamped upload folders
│       ├── Fonts/           # Extracted font files
│       ├── upload-metadata.json # Upload metadata
│       └── ...              # Extracted IDML content
└── ...                      # Config files (next.config.js, etc.)
```

## Key Components

### IDMLParser

The core parser that processes IDML content. It's modularized into specialized parsers for different element types:

- `IDMLParser`: Main coordination class
- `rectangleParser`: Parses rectangle elements
- `ovalParser`: Parses oval elements
- `polygonParser`: Parses polygon elements
- `textFrameParser`: Parses text frame elements
- `storyParser`: Parses text stories and content

### IDMLViewer

The main rendering component that takes parsed IDML data and renders it as HTML/CSS/SVG:

- Handles page navigation for multi-page documents
- Applies correct positioning and styling
- Loads and applies custom fonts
- Renders different element types (text frames, shapes, etc.)

### FontPreview

A utility component for previewing loaded fonts:

- Shows a list of all detected fonts
- Displays sample text in each font
- Confirms that fonts are correctly loaded

## Font Processing System

Font handling is a critical aspect of the application, ensuring that text is displayed with the correct typography:

1. **Detection**:

   - The `font_processor.py` script scans uploaded directories for font files
   - Supports various font formats (.otf, .ttf, .woff, .woff2, .eot, .tiff)
   - Preserves folder structure for fonts with complex distributions

2. **Storage**:

   - Detected fonts are copied to a dedicated 'Fonts' directory within the upload folder
   - Original file paths are preserved when needed

3. **Loading**:

   - The `loadCustomFonts` function in `idmlRenderUtils.js` loads fonts dynamically
   - Fonts are loaded using the CSS FontFace API
   - A font registry tracks loaded fonts to prevent duplicates

4. **Font Name Handling**:

   - The `cleanFontName` function handles special characters in font names
   - Converts font names to be CSS-compatible (e.g., "Susie's Hand" → "SusiesHand")

5. **Font Family Extraction**:

   - The `extractFontFamily` function extracts base font family names from full font names
   - Removes style suffixes (e.g., "Aileron-Bold" → "Aileron")

6. **Font Application**:
   - Cleaned font names are applied to text elements
   - Multiple fallbacks ensure text is displayed properly

## API Endpoints

### `/api/upload`

- **Method**: POST
- **Purpose**: Handles file uploads, extracts IDML content, processes fonts
- **Returns**: Upload ID for accessing the processed content

### `/api/fonts`

- **Method**: GET
- **Query Parameters**: `uploadId`
- **Purpose**: Lists all fonts available for a specific upload
- **Returns**: Array of font file information

### `/api/serve-font`

- **Method**: GET
- **Query Parameters**: `uploadId`, `fontName`
- **Purpose**: Serves a specific font file with proper MIME type
- **Returns**: Font file content

## Installation & Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/umerzzz/Re-amp.git
   cd Re-amp
   ```

2. **Install dependencies**:

   ```bash
   npm install
   pip install -r scripts/requirements.txt  # For Python scripts
   ```

3. **Create necessary directories**:

   ```bash
   mkdir -p uploads
   ```

4. **Start the development server**:

   ```bash
   npm run dev
   ```

5. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Development

### Key Files to Modify

- **IDML Parsing Logic**: `app/lib/idml/*.js`
- **Rendering Logic**: `app/lib/idmlRenderUtils.js`
- **Upload Handling**: `pages/api/upload.js`
- **Font Processing**: `scripts/font_processor.py`

### Adding Support for New Element Types

1. Create a new parser in the `app/lib/idml` directory
2. Add the parser to the imports in `app/lib/idml/index.js`
3. Update the rendering logic in `app/lib/idmlRenderUtils.js`

### Improving Font Support

1. Modify the `cleanFontName` and `extractFontFamily` functions in `idmlRenderUtils.js`
2. Update the font detection patterns in `scripts/font_processor.py`

## Deployment

1. **Build the application**:

   ```bash
   npm run build
   ```

2. **Start the production server**:

   ```bash
   npm start
   ```

3. **Environment Considerations**:
   - Ensure Python is available for font processing scripts
   - Configure proper permissions for the uploads directory
   - Consider using environment variables for configurable paths

---

_This project was built with Next.js 15.5.2 and React 19.1.0. For issues or contributions, please contact the repository maintainers._
