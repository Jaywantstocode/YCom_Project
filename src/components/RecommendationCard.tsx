import { Recommendation } from '@/hooks/useRecommendations';

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown time';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'A few minutes ago';
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    }
  };

  return (
    <div className="py-3 border-b border-gray-200 last:border-b-0">
      <div className="text-xs text-gray-500 mb-2">
        {formatDate(recommendation.created_at)}
      </div>
      <div className="text-sm text-gray-700 leading-relaxed">
        {recommendation.content || 'No content available'}
      </div>
    </div>
  );
}
