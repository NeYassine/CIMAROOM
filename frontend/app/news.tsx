import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { useRouter } from 'expo-router';

interface NewsArticle {
  id: string;
  title: string;
  title_arabic: string;
  summary: string;
  summary_arabic: string;
  link: string;
  published: string;
  published_arabic: string;
  author: string;
  image_url: string;
  source: string;
  category: string;
}

interface NewsResponse {
  articles: NewsArticle[];
  total: number;
  page: number;
  source: string;
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function NewsScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  // State management
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedSource, setSelectedSource] = useState('all');

  // Source filter options
  const sourceFilters = [
    { id: 'all', name: 'جميع المصادر', color: '#FFD700' },
    { id: 'Anime News Network', name: 'شبكة أخبار الأنمي', color: '#FF6B6B' },
    { id: 'MyAnimeList', name: 'ماي أنمي ليست', color: '#2E51A2' },
    { id: 'Crunchyroll', name: 'كرانشي رول', color: '#F47521' },
  ];

  // Fetch news articles
  const fetchNews = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        if (!append) setArticles([]);
      } else {
        setLoadingMore(true);
      }

      const response = await fetch(`${BACKEND_URL}/api/news?page=${pageNum}&limit=20`);
      const data: NewsResponse = await response.json();
      
      if (data.articles) {
        let filteredArticles = data.articles;
        
        // Filter by source if selected
        if (selectedSource !== 'all') {
          filteredArticles = data.articles.filter(article => article.source === selectedSource);
        }

        if (append) {
          setArticles(prev => [...prev, ...filteredArticles]);
        } else {
          setArticles(filteredArticles);
        }
        
        setHasMorePages(data.articles.length >= 20);
      }
      
    } catch (error) {
      console.error('Error fetching news:', error);
      Alert.alert('خطأ', 'فشل في تحميل الأخبار');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchNews(1, false);
  };

  // Load more articles
  const loadMore = () => {
    if (!loadingMore && hasMorePages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNews(nextPage, true);
    }
  };

  // Handle source filter change
  const handleSourceFilter = (sourceId: string) => {
    setSelectedSource(sourceId);
    setPage(1);
    fetchNews(1, false);
  };

  // State for in-app article reader
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [showArticleReader, setShowArticleReader] = useState(false);
  const [articleContent, setArticleContent] = useState('');
  const [loadingArticle, setLoadingArticle] = useState(false);

  // Open article in app
  const openArticleInApp = async (article: NewsArticle) => {
    setSelectedArticle(article);
    setShowArticleReader(true);
    setLoadingArticle(true);
    
    try {
      // For now, show the summary and link to full article
      // In a real implementation, you might scrape the full content
      setArticleContent(article.summary_arabic || article.summary);
    } catch (error) {
      console.error('Error loading article:', error);
      setArticleContent('لا يمكن تحميل محتوى المقال');
    } finally {
      setLoadingArticle(false);
    }
  };

  // Open article link externally (fallback)
  const openArticleLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('خطأ', 'لا يمكن فتح الرابط');
      }
    } catch (error) {
      Alert.alert('خطأ', 'لا يمكن فتح الرابط');
    }
  };

  // Format time ago
  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'منذ دقائق';
      if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
      if (diffInHours < 48) return 'منذ يوم واحد';
      
      const diffInDays = Math.floor(diffInHours / 24);
      return `منذ ${diffInDays} أيام`;
    } catch {
      return '';
    }
  };

  // Initial data load
  useEffect(() => {
    fetchNews();
  }, []);

  // Re-fetch when source filter changes
  useEffect(() => {
    if (selectedSource) {
      fetchNews();
    }
  }, [selectedSource]);

  // Render source filters
  const renderSourceFilters = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.filtersContainer}
      contentContainerStyle={styles.filtersContent}
    >
      {sourceFilters.map((source) => (
        <TouchableOpacity
          key={source.id}
          style={[
            styles.filterButton,
            selectedSource === source.id && [styles.activeFilterButton, { backgroundColor: source.color }]
          ]}
          onPress={() => handleSourceFilter(source.id)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.filterButtonText,
            selectedSource === source.id && styles.activeFilterButtonText
          ]}>
            {source.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // Render news article
  const renderNewsArticle = ({ item }: { item: NewsArticle }) => (
    <TouchableOpacity 
      style={styles.articleCard}
      onPress={() => openArticleLink(item.link)}
      activeOpacity={0.8}
    >
      <View style={styles.articleContent}>
        {/* Article Image */}
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.articleImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.articleImage, styles.placeholderImage]}>
            <Ionicons name="newspaper-outline" size={40} color="#666" />
          </View>
        )}
        
        {/* Article Info */}
        <View style={styles.articleInfo}>
          {/* Source and Time */}
          <View style={styles.articleMeta}>
            <View style={styles.sourceContainer}>
              <Text style={styles.sourceText}>{item.source}</Text>
              <View style={[styles.sourceDot, { 
                backgroundColor: sourceFilters.find(s => s.name.includes(item.source.split(' ')[0]))?.color || '#FFD700' 
              }]} />
            </View>
            <Text style={styles.timeText}>{getTimeAgo(item.published)}</Text>
          </View>
          
          {/* Title */}
          <Text style={styles.articleTitle} numberOfLines={2}>
            {item.title_arabic && item.title_arabic !== item.title ? item.title_arabic : item.title}
          </Text>
          
          {/* Summary */}
          <Text style={styles.articleSummary} numberOfLines={3}>
            {item.summary_arabic && item.summary_arabic !== item.summary ? item.summary_arabic : item.summary}
          </Text>
          
          {/* Author */}
          {item.author && (
            <Text style={styles.authorText}>بواسطة: {item.author}</Text>
          )}
          
          {/* Read More */}
          <View style={styles.readMoreContainer}>
            <Text style={styles.readMoreText}>اقرأ المزيد</Text>
            <Ionicons name="chevron-back" size={16} color="#FFD700" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أخبار الأنمي</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* Source Filters */}
      {renderSourceFilters()}

      {/* Articles Counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {articles.length} خبر متاح
        </Text>
      </View>

      {/* News List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>جاري تحميل الأخبار...</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          renderItem={renderNewsArticle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#FFD700']}
              tintColor="#FFD700"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={() => 
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#FFD700" />
                <Text style={styles.loadingText}>جاري تحميل المزيد...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>لا توجد أخبار متاحة</Text>
              <Text style={styles.emptySubtext}>اسحب للأسفل للتحديث</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Tajawal_700Bold',
  },
  filtersContainer: {
    paddingVertical: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filtersContent: {
    paddingHorizontal: 20,
    paddingRight: 20,
  },
  filterButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginLeft: 12,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeFilterButton: {
    backgroundColor: '#FFD700',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'Tajawal_400Regular',
  },
  activeFilterButtonText: {
    color: '#000',
    fontWeight: '600',
    fontFamily: 'Tajawal_500Medium',
  },
  counterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  counterText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'right',
    fontFamily: 'Tajawal_400Regular',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  articleCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
  },
  articleContent: {
    flexDirection: 'row-reverse',
    padding: 15,
  },
  articleImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#333',
    marginLeft: 15,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleInfo: {
    flex: 1,
  },
  articleMeta: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    fontFamily: 'Tajawal_500Medium',
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Tajawal_400Regular',
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'right',
    lineHeight: 22,
    fontFamily: 'Tajawal_500Medium',
  },
  articleSummary: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 8,
    fontFamily: 'Tajawal_400Regular',
  },
  authorText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 8,
    fontFamily: 'Tajawal_400Regular',
  },
  readMoreContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  readMoreText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginRight: 4,
    fontFamily: 'Tajawal_500Medium',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 10,
    fontFamily: 'Tajawal_400Regular',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
    fontFamily: 'Tajawal_500Medium',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Tajawal_400Regular',
  },
});