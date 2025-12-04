# Document Management System

A comprehensive document management system for the expropriation platform with advanced features including drag-and-drop uploads, version control, permissions, search, and bulk operations.

## 🚀 Features

### Core Features
- **Drag & Drop File Upload** - Intuitive multi-file upload with progress tracking
- **Document Storage & Metadata** - Comprehensive metadata management with custom fields
- **Version Control** - Complete document versioning with change tracking
- **Role-Based Permissions** - Granular access control by user, role, and department
- **Document Preview** - Multi-format preview with thumbnails and text extraction
- **Template Management** - Standardized document templates with variables
- **Digital Signatures** - Simple digital signature workflow integration
- **Audit Trail** - Complete change history and activity logging
- **Advanced Search** - Full-text search with faceted filtering
- **Bulk Operations** - Bulk download with packaging and metadata

### Advanced Features
- **Security Levels** - Multiple security classifications (Public, Internal, Confidential, Secret, Top Secret)
- **Document Categories** - Hierarchical categorization system
- **File Type Support** - Support for documents, images, videos, archives, and more
- **Storage Management** - Organized storage with date-based directory structure
- **File Integrity** - SHA-256 hash verification for all files
- **Content Indexing** - Text extraction for searchable content
- **Expiration & Retention** - Automated document lifecycle management
- **Access Analytics** - Download and view tracking
- **Document Sharing** - Secure link-based sharing with permissions

## 📁 Database Schema

The document management system includes the following enhanced database models:

### Core Models
- `Document` - Main document entity with comprehensive metadata
- `DocumentVersion` - Version control with change tracking
- `DocumentPermission` - Granular permission management
- `DocumentCategoryRef` - Hierarchical category system
- `DocumentTemplate` - Template management system

### Supporting Models
- `DocumentHistory` - Complete audit trail
- `DocumentAction` - User interaction tracking
- `DocumentTag` - Flexible tagging system
- `DocumentShare` - Secure sharing mechanism
- `DocumentWorkflow` - Approval workflow integration
- `DocumentComment` - Document collaboration

## 🔧 API Endpoints

### Document Management
- `GET /api/documents` - List documents with filtering and pagination
- `POST /api/documents` - Upload new document
- `GET /api/documents/[id]` - Get document details
- `PUT /api/documents/[id]` - Update document metadata
- `DELETE /api/documents/[id]` - Delete document
- `GET /api/documents/[id]/download` - Download document
- `GET /api/documents/[id]/preview` - Generate document preview

### Version Control
- `GET /api/documents/[id]/versions` - List document versions
- `POST /api/documents/[id]/versions` - Create new version

### Permissions
- `GET /api/documents/[id]/permissions` - Get document permissions
- `POST /api/documents/[id]/permissions` - Create permission
- `PUT /api/documents/[id]/permissions/[permissionId]` - Update permission
- `DELETE /api/documents/[id]/permissions/[permissionId]` - Delete permission

### Search & Discovery
- `POST /api/documents/search` - Advanced document search
- `GET /api/documents/search/suggestions` - Get search suggestions

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/[id]` - Get template details
- `PUT /api/templates/[id]` - Update template
- `POST /api/templates/[id]/use` - Use template to create document

### Bulk Operations
- `POST /api/documents/bulk-download` - Bulk document download

### History & Audit
- `GET /api/documents/[id]/history` - Get document history
- `POST /api/documents/[id]/history/export` - Export audit trail

## 🎨 Frontend Components

### DocumentUpload Component
```tsx
<DocumentUpload
  onUploadComplete={(documents) => console.log('Uploaded:', documents)}
  maxFiles={10}
  caseId="optional-case-id"
/>
```

Features:
- Drag & drop interface
- Multiple file selection
- Progress tracking
- File validation
- Metadata configuration
- Batch upload support

### DocumentViewer Component
```tsx
<DocumentViewer
  document={documentObject}
  onClose={() => setShowViewer(false)}
  showActions={true}
/>
```

Features:
- Multi-format preview
- Document metadata display
- Download and sharing actions
- Version information
- Access statistics

### DocumentSearch Component
```tsx
<DocumentSearch
  onResults={(results) => setResults(results)}
  onResultSelect={(doc) => setSelectedDocument(doc)}
  compact={false}
  initialQuery="search term"
/>
```

Features:
- Advanced search with filters
- Faceted search results
- Real-time suggestions
- Sorting and pagination
- Relevance scoring

## 🔐 Security Features

### Access Control
- **Role-Based Permissions** - Permissions by user role (Super Admin, Department Admin, Analyst, etc.)
- **Document-Level Permissions** - Individual document access control
- **Department-Based Access** - Permissions tied to organizational structure
- **Temporary Access Grants** - Time-limited permission assignments

### Security Classifications
- **Public** - Accessible to all users
- **Internal** - Organization-wide access
- **Confidential** - Restricted access based on role/department
- **Secret** - High-security classification
- **Top Secret** - Maximum security classification

### Data Protection
- **File Encryption** - Optional encryption for sensitive documents
- **Secure File Storage** - Organized storage with access controls
- **File Integrity** - SHA-256 hash verification
- **Audit Logging** - Complete access and modification tracking

## 📊 File Type Support

### Document Types
- **PDF** - `.pdf`
- **Microsoft Word** - `.doc`, `.docx`
- **Microsoft Excel** - `.xls`, `.xlsx`
- **Microsoft PowerPoint** - `.ppt`, `.pptx`
- **Plain Text** - `.txt`, `.csv`
- **HTML** - `.html`, `.htm`

### Image Types
- **JPEG** - `.jpg`, `.jpeg`
- **PNG** - `.png`
- **GIF** - `.gif`
- **WebP** - `.webp`
- **TIFF** - `.tiff`, `.tif`

### Archive Types
- **ZIP** - `.zip`
- **RAR** - `.rar`
- **7Z** - `.7z`

## 🗂️ Storage Organization

### Directory Structure
```
uploads/
├── documents/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 01/
│   │   │   └── 02/
│   │   └── 02/
│   └── 2025/
├── thumbnails/
└── temp/
```

### File Naming
- **Original files**: `timestamp-randomhash-originalname.ext`
- **Thumbnails**: `documentid_size.jpg`
- **Version files**: `timestamp-randomhash-name_vX.ext`

## 🔄 Version Control

### Version Management
- **Automatic Versioning** - Create versions on major changes
- **Manual Versioning** - Create versions on demand
- **Change Tracking** - Track all modifications
- **Rollback Support** - Revert to previous versions
- **Version Comparison** - Compare different versions
- **Branch Support** - Create version branches (future)

### Version Types
- **Major Versions** - Significant changes (10, 20, 30...)
- **Minor Versions** - Small changes (1, 2, 3...)
- **Draft Versions** - Work-in-progress versions
- **Published Versions** - Official versions

## 🔍 Search Features

### Search Capabilities
- **Full-Text Search** - Search within document content
- **Metadata Search** - Search by title, description, tags
- **Faceted Search** - Filter by type, category, date, etc.
- **Fuzzy Search** - Handle typos and variations
- **Relevance Scoring** - Rank results by relevance
- **Saved Searches** - Store and reuse search queries

### Search Filters
- **Document Type** - Filter by file type
- **Category** - Filter by document category
- **Status** - Filter by document status
- **Security Level** - Filter by classification
- **Date Range** - Filter by creation/modification date
- **Size Range** - Filter by file size
- **Tags** - Filter by document tags
- **User** - Filter by uploader or modifier

## 📋 Templates

### Template Features
- **Template Creation** - Create reusable document templates
- **Variable Support** - Define template variables and placeholders
- **Template Categories** - Organize templates by type
- **Template Versioning** - Track template changes
- **Template Usage** - Track template usage statistics
- **Template Permissions** - Control who can use templates

### Template Types
- **Legal Templates** - Contracts, agreements, legal documents
- **Form Templates** - Standardized forms and checklists
- **Report Templates** - Analysis and summary reports
- **Letter Templates** - Correspondence templates
- **Contract Templates** - Standard contract formats
- **Certificate Templates** - Award and certification templates

## 📊 Analytics & Reporting

### Document Analytics
- **Upload Statistics** - Track document uploads over time
- **Access Analytics** - Monitor document views and downloads
- **Storage Analytics** - Track storage usage and trends
- **User Activity** - Monitor user document interactions
- **Search Analytics** - Track search patterns and popular content

### Reports
- **Document Inventory** - Complete list of all documents
- **Access Report** - Document access and modification history
- **Storage Report** - Storage usage and optimization suggestions
- **Activity Report** - User and system activity summaries
- **Compliance Report** - Security and compliance tracking

## 🚀 Usage Examples

### Basic Document Upload
```tsx
import { DocumentUpload } from '@/components/documents/DocumentUpload';

function MyComponent() {
  return (
    <DocumentUpload
      onUploadComplete={(docs) => {
        console.log('Uploaded documents:', docs);
      }}
      maxFiles={5}
    />
  );
}
```

### Advanced Search
```tsx
import { DocumentSearch } from '@/components/documents/DocumentSearch';

function SearchPage() {
  const handleResults = (results) => {
    // Handle search results
  };

  return (
    <DocumentSearch
      onResults={handleResults}
      onResultSelect={(doc) => {
        // Handle document selection
      }}
    />
  );
}
```

### Document Management API
```typescript
// Upload a document
const formData = new FormData();
formData.append('file', file);
formData.append('documentData', JSON.stringify({
  title: 'My Document',
  description: 'Document description',
  documentType: 'LEGAL_DOCUMENT',
  category: 'LEGAL',
  securityLevel: 'CONFIDENTIAL'
}));

const response = await fetch('/api/documents', {
  method: 'POST',
  body: formData
});

const document = await response.json();
```

## 🔧 Configuration

### Environment Variables
```env
# Document storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600  # 100MB
ALLOWED_MIME_TYPES=application/pdf,image/jpeg,...

# Security
ENABLE_FILE_ENCRYPTION=false
DEFAULT_SECURITY_LEVEL=INTERNAL

# Search
ENABLE_CONTENT_INDEXING=true
SEARCH_RESULTS_PER_PAGE=20

# Templates
ENABLE_TEMPLATE_APPROVAL=false
DEFAULT_TEMPLATE_CATEGORY=ADMINISTRATIVE
```

### Storage Configuration
```typescript
const storageConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    // ... other types
  ],
  storagePath: './uploads/documents',
  thumbnailPath: './uploads/thumbnails',
  enableEncryption: false,
  defaultSecurityLevel: 'INTERNAL'
};
```

## 🧪 Testing

### Running Tests
```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Test Coverage
- **Upload Functionality** - File upload, validation, processing
- **Search Features** - Search queries, filters, results
- **Permission System** - Access control, role-based permissions
- **Version Control** - Version creation, management, rollback
- **Preview System** - Document preview, thumbnails
- **API Endpoints** - All API functionality

## 🚨 Security Considerations

### File Upload Security
- **File Type Validation** - Strict MIME type checking
- **File Size Limits** - Configurable size restrictions
- **Virus Scanning** - Integration with antivirus systems (future)
- **Content Scanning** - Scan for malicious content (future)

### Access Control
- **Permission Validation** - Server-side permission checks
- **Session Management** - Secure session handling
- **Rate Limiting** - Prevent abuse and attacks
- **Audit Logging** - Complete access tracking

### Data Protection
- **Encryption** - Optional file encryption
- **Secure Storage** - Protected file storage
- **Backup Systems** - Automated backup processes
- **Data Retention** - Configurable retention policies

## 🛣️ Roadmap

### Future Enhancements
- **Advanced OCR** - Text extraction from images and PDFs
- **Document Comparison** - Visual and textual diff tools
- **Workflow Integration** - Advanced approval workflows
- **AI-Powered Search** - Natural language processing
- **Mobile Support** - Native mobile applications
- **Cloud Storage** - Integration with cloud storage providers
- **Collaboration Tools** - Real-time document collaboration
- **Digital Signatures** - Advanced cryptographic signatures

### Performance Improvements
- **Caching System** - Redis caching for frequently accessed data
- **CDN Integration** - Content delivery network for files
- **Database Optimization** - Improved query performance
- **Background Processing** - Async file processing

## 📞 Support

For support and questions about the document management system:

1. **Documentation** - Check this documentation and inline code comments
2. **API Reference** - Review API endpoint documentation
3. **Examples** - Look at the example implementations
4. **Issues** - Report bugs and request features via the issue tracker

## 📄 License

This document management system is part of the expropriation platform and follows the same licensing terms.