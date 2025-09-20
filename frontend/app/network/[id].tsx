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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface Anime {
  id: number;
  title: string;
  title_arabic?: string;
  original_title?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  overview_arabic?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  episode_count?: number;
  status?: string;
  genres?: Array<{ id: number; name: string; name_arabic: string }>;
  content_type: string;
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function NetworkScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  // State management
  const [networkAnime, setNetworkAnime] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch network anime
  const fetchNetworkAnime = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        if (!append) setNetworkAnime([]);
      } else {
        setLoadingMore(true);
      }

      const response = await fetch(`${BACKEND_URL}/api/anime/network/${id}?page=${pageNum}&limit=20`);
      const data = await response.json();
      
      if (data.results) {
        if (append) {
          setNetworkAnime(prev => [...prev, ...data.results]);
        } else {
          setNetworkAnime(data.results);
        }
        
        setHasMorePages(data.results.length >= 20);
      }
      
    } catch (error) {
      console.error('Error fetching network anime:', error);
      Alert.alert('خطأ', 'فشل في تحميل أنميات الشبكة');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load more anime
  const loadMore = () => {
    if (!loadingMore && hasMorePages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNetworkAnime(nextPage, true);
    }
  };

  // Handle anime selection
  const handleAnimeSelection = (anime: Anime) => {
    // Go back to main page and show details
    router.back();
    // You might want to pass the anime details back or use a global state
  };

  // Initial data load
  useEffect(() => {
    if (id) {
      fetchNetworkAnime();
    }
  }, [id]);

  // Render anime card
  const renderAnimeCard = ({ item }: { item: Anime }) => (
    <TouchableOpacity 
      style={styles.animeCard}
      onPress={() => handleAnimeSelection(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{
          uri: item.poster_path
            ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
            : 'https://via.placeholder.com/150x225/333/fff?text=No+Image'
        }}
        style={styles.animeImage}
        resizeMode="cover"
      />
      <View style={styles.animeInfo}>
        <Text style={styles.animeTitle} numberOfLines={2}>
          {item.title_arabic || item.title || 'بدون عنوان'}
        </Text>
        
        <View style={styles.animeMetadata}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>
              {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
            </Text>
          </View>
          
          <Text style={styles.typeText}>
            {item.content_type === 'movie' ? 'فيلم' : 'مسلسل'}
          </Text>
        </View>
        
        {item.release_date || item.first_air_date ? (
          <Text style={styles.yearText}>
            {(item.release_date || item.first_air_date)?.substring(0, 4)}
          </Text>
        ) : null}
        
        {item.overview_arabic || item.overview ? (
          <Text style={styles.overviewText} numberOfLines={3}>
            {item.overview_arabic || item.overview}
          </Text>
        ) : null}
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {decodeURIComponent(name as string) || 'شبكة الأنمي'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Results Summary */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {networkAnime.length} أنمي
        </Text>
      </View>

      {/* Anime List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>جاري تحميل أنميات الشبكة...</Text>
        </View>
      ) : (
        <FlatList
          data={networkAnime}
          renderItem={renderAnimeCard}
          keyExtractor={(item) => `${item.id}-${item.content_type}`}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
              <Ionicons name="tv-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>لا توجد أنميات</Text>
              <Text style={styles.emptySubtext}>لا توجد أنميات متاحة من هذه الشبكة</Text>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Tajawal_700Bold',
  },
  headerSpacer: {
    width: 24,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultsCount: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'right',
    fontFamily: 'Tajawal_500Medium',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  animeCard: {
    width: '48%',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
  },
  animeImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#333',
  },
  animeInfo: {
    padding: 12,
  },
  animeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'right',
    fontFamily: 'Tajawal_500Medium',
  },
  animeMetadata: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#FFD700',
    marginRight: 4,
    fontFamily: 'Tajawal_400Regular',
  },
  typeText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Tajawal_400Regular',
  },
  yearText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
    textAlign: 'right',
    fontFamily: 'Tajawal_400Regular',
  },
  overviewText: {
    fontSize: 12,
    color: '#ccc',
    lineHeight: 16,
    textAlign: 'right',
    fontFamily: 'Tajawal_400Regular',
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