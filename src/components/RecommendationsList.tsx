import { useRecommendations } from '@/hooks/useRecommendations';
import { RecommendationCard } from './RecommendationCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Lightbulb, AlertCircle } from 'lucide-react';

interface RecommendationsListProps {
  limit?: number;
  showHeader?: boolean;
  className?: string;
}

export function RecommendationsList({ 
  limit = 10, 
  showHeader = true,
  className = ""
}: RecommendationsListProps) {
  const { recommendations, loading, error, refetch } = useRecommendations(limit);

  if (loading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Past Advice
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-3 border-b border-gray-200 last:border-b-0">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Past Advice
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Past Advice
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Lightbulb className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No advice available yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Run productivity analysis to receive AI advice
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Past Advice
            </CardTitle>
            <Button onClick={refetch} variant="ghost" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {recommendations.map((recommendation) => (
          <RecommendationCard 
            key={recommendation.id} 
            recommendation={recommendation} 
          />
        ))}
      </CardContent>
    </Card>
  );
}
