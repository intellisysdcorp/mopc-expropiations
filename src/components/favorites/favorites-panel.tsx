'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  StarOff,
  FileText,
  Users,
  Building2,
  X,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import clientLogger from '@/lib/client-logger';

interface FavoriteItem {
  id: string;
  type: 'case' | 'document' | 'user' | 'department';
  title: string;
  description?: string;
  url: string;
  metadata?: Record<string, any>;
  addedAt: string;
}

interface FavoritesPanelProps {
  className?: string;
  maxItems?: number;
}

export function FavoritesPanel({ className, maxItems = 5 }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  // Load favorites from API
  const loadFavorites = async () => {
    try {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites || []);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Failed to load favorites:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  // Remove from favorites
  const removeFromFavorites = async (id: string) => {
    try {
      const response = await fetch(`/api/favorites/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFavorites(prev => prev.filter(fav => fav.id !== id));
        toast({
          title: "Eliminado de favoritos",
          description: "El elemento ha sido eliminado de tus favoritos.",
        });
      }
    } catch (_) {
      toast({
        title: "Error",
        description: "No se pudo eliminar de favoritos.",
        variant: "destructive",
      });
    }
  };

  // Navigate to favorite
  const handleFavoriteClick = (favorite: FavoriteItem) => {
    router.push(favorite.url);
  };

  // Get icon for type
  const getTypeIcon = (type: string) => {
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
        return <Star className="h-4 w-4 text-gray-600" />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Favoritos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Favoritos
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/favorites')}
          className="text-xs"
        >
          Ver todos
        </Button>
      </CardHeader>
      <CardContent>
        {favorites.length === 0 ? (
          <div className="text-center py-6">
            <StarOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              No tienes favoritos aún
            </p>
            <p className="text-xs text-muted-foreground">
              Usa el botón de estrella en cualquier caso, documento o usuario para añadirlo aquí
            </p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {favorites.slice(0, maxItems).map((favorite) => (
                <div
                  key={favorite.id}
                  className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                  onClick={() => handleFavoriteClick(favorite)}
                >
                  <div className="mt-1">
                    {getTypeIcon(favorite.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate mb-1">
                      {favorite.title}
                    </h4>
                    {favorite.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                        {favorite.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {favorite.type === 'case' ? 'Caso' :
                           favorite.type === 'document' ? 'Documento' :
                           favorite.type === 'user' ? 'Usuario' : 'Departamento'}
                        </Badge>
                        {favorite.metadata?.status && (
                          <Badge variant="outline" className="text-xs">
                            {favorite.metadata.status}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(favorite.addedAt)}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromFavorites(favorite.id);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Eliminar de favoritos
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Hook to manage favorites for individual items
export function useFavorite(item: {
  id: string;
  type: 'case' | 'document' | 'user' | 'department';
  title: string;
  description?: string;
  url: string;
  metadata?: Record<string, any>;
}) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if item is favorite
  const checkFavorite = useCallback(async () => {
    try {
      const response = await fetch(`/api/favorites/check?type=${item.type}&itemId=${item.id}`);
      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Failed to check favorite status:', error);
      }
    }
  }, [item]);

  useEffect(() => {
    checkFavorite();
  }, [checkFavorite]);

  // Toggle favorite
  const toggleFavorite = async () => {
    setIsLoading(true);
    try {
      if (isFavorite) {
        // Remove from favorites
        const response = await fetch(`/api/favorites/by-item?type=${item.type}&itemId=${item.id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setIsFavorite(false);
          toast({
            title: "Eliminado de favoritos",
            description: `${item.title} ha sido eliminado de tus favoritos.`,
          });
        }
      } else {
        // Add to favorites
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (response.ok) {
          setIsFavorite(true);
          toast({
            title: "Añadido a favoritos",
            description: `${item.title} ha sido añadido a tus favoritos.`,
          });
        }
      }
    } catch (_) {
      toast({
        title: "Error",
        description: "No se pudo actualizar favoritos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isFavorite,
    isLoading,
    toggleFavorite,
  };
}

// Favorite button component
export function FavoriteButton({ item }: { item: Parameters<typeof useFavorite>[0] }) {
  const { isFavorite, isLoading, toggleFavorite } = useFavorite(item);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleFavorite}
      disabled={isLoading}
      className={cn(
        "h-8 w-8 p-0",
        isFavorite && "text-yellow-600 hover:text-yellow-700"
      )}
      aria-label={isFavorite ? "Eliminar de favoritos" : "Añadir a favoritos"}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
      ) : isFavorite ? (
        <Star className="h-4 w-4 fill-current" />
      ) : (
        <StarOff className="h-4 w-4" />
      )}
    </Button>
  );
}