'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Hash,
  Image as ImgIcon,
  Lock,
  Music,
  Share,
  Shield,
  Tag,
  Unlock,
  User,
  Video,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

interface DocumentViewerProps {
  document: any;
  onClose?: () => void;
  showActions?: boolean;
}

interface DocumentPreview {
  type: 'image' | 'pdf' | 'text' | 'unsupported';
  url?: string;
  content?: any;
  thumbnail?: string;
}

export function DocumentViewer({ document, onClose, showActions = true }: DocumentViewerProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');

  // Document type icon mapping
  const getDocumentIcon = (mimeType: string, className?: string) => {
    const iconProps = { className: className || "h-5 w-5 text-gray-500" };

    if (mimeType.startsWith('image/')) return <ImgIcon {...iconProps} />;
    if (mimeType.startsWith('video/')) return <Video {...iconProps} />;
    if (mimeType.startsWith('audio/')) return <Music {...iconProps} />;
    if (mimeType.includes('pdf')) return <FileText {...iconProps} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return <Archive {...iconProps} />;
    return <FileText {...iconProps} />;
  };

  // Security level color mapping
  const getSecurityColor = (level: string) => {
    const colors = {
      PUBLIC: 'bg-green-100 text-green-800',
      INTERNAL: 'bg-blue-100 text-blue-800',
      CONFIDENTIAL: 'bg-yellow-100 text-yellow-800',
      SECRET: 'bg-orange-100 text-orange-800',
      TOP_SECRET: 'bg-red-100 text-red-800',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadPreview = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/documents/${document.id}/preview`);
      if (response.ok) {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          const data = await response.json();
          setPreview({
            type: data.type || 'unsupported',
            content: data,
            thumbnail: data.thumbnail,
          });
        } else {
          setPreview({
            type: 'image',
            url: response.url,
          });
        }
      } else {
        const error = await response.json();
        setPreview({
          type: 'unsupported',
          content: { error: error.error || 'Preview not available' },
        });
      }
    } catch (_) {
      setPreview({
        type: 'unsupported',
        content: { error: 'Failed to load preview' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [document.id]);

  // Load document preview
  useEffect(() => {
    if (document && activeTab === 'preview') {
      loadPreview();
    }
  }, [loadPreview, activeTab, document]);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = document.originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Update download count
        document.downloadCount = (document.downloadCount || 0) + 1;

        toast.success('Document downloaded successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Download failed');
      }
    } catch (_) {
      toast.error('Failed to download document');
    }
  };

  const handleShare = async () => {
    try {
      const response = await fetch(`/api/documents/${document.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareType: 'LINK',
          permissions: ['view', 'download'],
        }),
      });

      if (response.ok) {
        const shareData = await response.json();
        const shareUrl = `${window.location.origin}/shared/${shareData.shareToken}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied to clipboard');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create share link');
      }
    } catch (_) {
      toast.error('Failed to share document');
    }
  };

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (!preview) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <FileText className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-500">Preview not available</p>
            <Button onClick={handleDownload} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download to view
            </Button>
          </div>
        </div>
      );
    }

    switch (preview.type) {
      case 'image':
        return (
          <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg p-4">
            <Image
              src={preview.url!}
              alt={document.title}
              className="max-w-full max-h-full object-contain rounded shadow-lg"
            />
          </div>
        );

      case 'text':
        return (
          <div className="h-96">
            <ScrollArea className="h-full bg-gray-50 rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {preview.content?.content || 'No content available'}
              </pre>
            </ScrollArea>
          </div>
        );

      case 'pdf':
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-500">
                {preview.content?.message || 'PDF preview not available'}
              </p>
              <Button onClick={handleDownload} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-500">
                {preview.content?.error || 'Preview not supported for this file type'}
              </p>
              <Button onClick={handleDownload} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Document
              </Button>
            </div>
          </div>
        );
    }
  };

  const renderMetadata = () => {
    return (
      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Hash className="h-4 w-4 text-gray-500" />
                <span className="font-medium">ID:</span>
                <span className="text-gray-600">{document.id.substring(0, 8)}...</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Type:</span>
                <Badge variant="secondary">
                  {document.documentType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Tag className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Category:</span>
                <Badge variant="outline">
                  {document.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Shield className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Security:</span>
                <Badge className={getSecurityColor(document.securityLevel)}>
                  {document.securityLevel.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Hash className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Size:</span>
                <span className="text-gray-600">{formatFileSize(document.fileSize)}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Modified:</span>
                <span className="text-gray-600">
                  {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Status Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Status Information</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge
                variant={document.status === 'APPROVED' ? 'default' :
                        document.status === 'DRAFT' ? 'secondary' : 'destructive'}
              >
                {document.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Version:</span>
              <span className="text-sm text-gray-600">v{document.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Latest:</span>
              {document.isLatest ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <span className="text-sm text-gray-500">No</span>
              )}
            </div>
            {document.expiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Expires:</span>
                <span className="text-sm text-gray-600">
                  {new Date(document.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Access Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Access Information</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Uploaded by:</span>
              <span className="text-gray-600">
                {document.uploadedBy?.fullName || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Created:</span>
              <span className="text-gray-600">
                {new Date(document.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Eye className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Views:</span>
              <span className="text-gray-600">{document.viewCount || 0}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Download className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Downloads:</span>
              <span className="text-gray-600">{document.downloadCount || 0}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              {document.isPublic ? (
                <Unlock className="h-4 w-4 text-green-500" />
              ) : (
                <Lock className="h-4 w-4 text-red-500" />
              )}
              <span className="font-medium">Visibility:</span>
              <span className="text-gray-600">
                {document.isPublic ? 'Public' : 'Private'}
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag: any) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
                  >
                    {tag.tag}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Case Information */}
        {document.case && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-4">Case Information</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Hash className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Case:</span>
                  <span className="text-gray-600">{document.case.fileNumber}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Title:</span>
                  <span className="text-gray-600">{document.case.title}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center space-x-2">
              {getDocumentIcon(document.mimeType)}
              <span>{document.title}</span>
            </CardTitle>
            <CardDescription>{document.description}</CardDescription>
          </div>
          {showActions && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  ×
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-6">
            {renderPreview()}
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <ScrollArea className="h-96">
              {renderMetadata()}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}