'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, FileText, Users, Building2, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { debounce } from 'lodash-es';
import { cn } from '@/lib/utils';
import clientLogger from '@/lib/client-logger';

interface SearchResult {
  id: string;
  type: 'case' | 'document' | 'user' | 'department';
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  url: string;
  relevance: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  took: number;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('global-search-recent');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to parse recent searches from localStorage:', error);
    }
  }, []);

  // Debounced search function
  const performSearch = debounce(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.ok) {
        const data: SearchResponse = await response.json();
        setResults(data.results);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Search failed:', error); 
      }
      setResults([]);
    } finally {
        setIsSearching(false);
    }
    }, 300)

  // Handle search input
  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  // Handle search result click
  const handleResultClick = (result: SearchResult) => {
    // Add to recent searches
    const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    try {
      localStorage.setItem('global-search-recent', JSON.stringify(newRecent));
    } catch (error) {
      console.warn('Failed to save recent searches to localStorage:', error);
    }

    // Navigate to result
    router.push(result.url);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  // Handle recent search click
  const handleRecentSearchClick = (searchTerm: string) => {
    setQuery(searchTerm);
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('global-search-recent');
    } catch (error) {
      console.warn('Failed to clear recent searches from localStorage:', error);
    }
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type]!.push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  // Get icon for result type
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'case':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'document':
        return <FileText className="h-4 w-4 text-green-600" />;
      case 'user':
        return <Users className="h-4 w-4 text-purple-600" />;
      case 'department':
        return <Building2 className="h-4 w-4 text-orange-600" />;
      default:
        return <Search className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get type label
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'case':
        return 'Casos';
      case 'document':
        return 'Documentos';
      case 'user':
        return 'Usuarios';
      case 'department':
        return 'Departamentos';
      default:
        return 'Otros';
    }
  };

  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="relative w-full max-w-sm justify-start text-sm text-muted-foreground"
            aria-label="Búsqueda global"
          >
            <Search className="h-4 w-4 mr-2" />
            Buscar en toda la plataforma...
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[80vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="sr-only">Búsqueda Global</DialogTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar casos, documentos, usuarios, departamentos..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-10 h-12 text-base"
                autoFocus
                aria-label="Término de búsqueda"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="p-6">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2 text-muted-foreground">Buscando...</span>
                </div>
              ) : query && results.length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(groupedResults).map(([type, typeResults]) => (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-3">
                        {getResultIcon(type)}
                        <h3 className="font-semibold text-sm text-muted-foreground">
                          {getTypeLabel(type)} ({typeResults.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {typeResults.map((result) => (
                          <Card
                            key={result.id}
                            className={cn(
                              "cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
                              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            )}
                            onClick={() => handleResultClick(result)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleResultClick(result);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Ver ${result.title}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm mb-1 truncate">
                                    {result.title}
                                  </h4>
                                  {result.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {result.description}
                                    </p>
                                  )}
                                  {result.metadata && (
                                    <div className="flex items-center gap-2 mt-2">
                                      {result.metadata.status && (
                                        <Badge variant="secondary" className="text-xs">
                                          {result.metadata.status}
                                        </Badge>
                                      )}
                                      {result.metadata.priority && (
                                        <Badge
                                          variant={result.metadata.priority === 'URGENT' ? 'destructive' : 'outline'}
                                          className="text-xs"
                                        >
                                          {result.metadata.priority}
                                        </Badge>
                                      )}
                                      {result.metadata.date && (
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(result.metadata.date).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {getResultIcon(type)}
                                  <span className="text-xs text-muted-foreground">
                                    {Math.round(result.relevance * 100)}%
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : query && results.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No se encontraron resultados
                  </h3>
                  <p className="text-muted-foreground">
                    Intenta con diferentes términos o verifica la ortografía
                  </p>
                </div>
              ) : recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-muted-foreground">
                      Búsquedas recientes
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearRecentSearches}
                      className="text-xs"
                    >
                      Limpiar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((searchTerm, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => handleRecentSearchClick(searchTerm)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleRecentSearchClick(searchTerm);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Buscar: ${searchTerm}`}
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        {searchTerm}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Búsqueda Global
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Busca casos, documentos, usuarios y departamentos en toda la plataforma
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Usa palabras clave para encontrar casos específicos</p>
                    <p>• Busca por nombres de usuarios o departamentos</p>
                    <p>• Encuentra documentos por título o contenido</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}