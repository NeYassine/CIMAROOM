import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  StatusBar,
  RefreshControl,
  Platform,
  Linking,
  Alert,
  I18nManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import * as SplashScreen from 'expo-splash-screen';

const { width: screenWidth } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  genres?: Array<{ name: string }>;
  origin_country?: string[];
  content_type: string;
  anime_confidence?: number;
}

interface AnimeResponse {
  results: Anime[];
  page: number;
  total_pages: number;
  total_results: number;
}

export default function Index() {
  const [popularAnime, setPopularAnime] = useState<Anime[]>([]);
  const [seasonalAnime, setSeasonalAnime] = useState<Anime[]>([]);
  const [topRatedAnime, setTopRatedAnime] = useState<Anime[]>([]);
  const [animeMovies, setAnimeMovies] = useState<Anime[]>([]);
  const [featuredAnime, setFeaturedAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMorePopular, setShowMorePopular] = useState(false);
  const [morePopularAnime, setMorePopularAnime] = useState<Anime[]>([]);
  const [morePopularLoading, setMorePopularLoading] = useState(false);
  const [morePopularPage, setMorePopularPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  
  // Seasonal anime states
  const [showMoreSeasonal, setShowMoreSeasonal] = useState(false);
  const [moreSeasonalAnime, setMoreSeasonalAnime] = useState<Anime[]>([]);
  const [moreSeasonalLoading, setMoreSeasonalLoading] = useState(false);
  const [moreSeasonalPage, setMoreSeasonalPage] = useState(1);
  const [hasMoreSeasonalPages, setHasMoreSeasonalPages] = useState(true);

  // Anime movies states
  const [showMoreMovies, setShowMoreMovies] = useState(false);
  const [moreMoviesAnime, setMoreMoviesAnime] = useState<Anime[]>([]);
  const [moreMoviesLoading, setMoreMoviesLoading] = useState(false);
  const [moreMoviesPage, setMoreMoviesPage] = useState(1);
  const [hasMoreMoviesPages, setHasMoreMoviesPages] = useState(true);

  // Load Tajawal fonts
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  // Enable RTL for Arabic
  useEffect(() => {
    I18nManager.forceRTL(true);
  }, []);

  // Fetch popular anime
  const fetchPopularAnime = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/top?limit=10`);
      const data: AnimeResponse = await response.json();
      const animeList = data.results || [];
      setPopularAnime(animeList);
      
      // Set featured anime (first one with highest rating)
      if (animeList.length > 0) {
        const featured = animeList.reduce((prev, current) => 
          (prev.vote_average || 0) > (current.vote_average || 0) ? prev : current
        );
        setFeaturedAnime(featured);
      }
    } catch (error) {
      console.error('Error fetching popular anime:', error);
    }
  };

  // Fetch seasonal anime
  const fetchSeasonalAnime = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/current-season?limit=8`);
      const data: AnimeResponse = await response.json();
      setSeasonalAnime(data.results || []);
    } catch (error) {
      console.error('Error fetching seasonal anime:', error);
    }
  };

  // Search anime
  const searchAnime = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/search?q=${encodeURIComponent(query)}&limit=15`);
      const data: AnimeResponse = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error searching anime:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch more seasonal anime for infinite scroll
  const fetchMoreSeasonalAnime = async (page: number = 1) => {
    try {
      setMoreSeasonalLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/current-season?page=${page}&limit=20`);
      const data: AnimeResponse = await response.json();
      
      if (page === 1) {
        setMoreSeasonalAnime(data.results || []);
      } else {
        setMoreSeasonalAnime(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMoreSeasonalPages(data.page < data.total_pages);
    } catch (error) {
      console.error('Error fetching more seasonal anime:', error);
    } finally {
      setMoreSeasonalLoading(false);
    }
  };

  // Handle load more seasonal anime
  const handleLoadMoreSeasonal = () => {
    setShowMoreSeasonal(true);
    setMoreSeasonalPage(1);
    fetchMoreSeasonalAnime(1);
  };

  // Handle infinite scroll in more seasonal page
  const handleLoadSeasonalNextPage = () => {
    if (!moreSeasonalLoading && hasMoreSeasonalPages) {
      const nextPage = moreSeasonalPage + 1;
      setMoreSeasonalPage(nextPage);
      fetchMoreSeasonalAnime(nextPage);
    }
  };

  // Fetch more popular anime for infinite scroll
  const fetchMorePopularAnime = async (page: number = 1) => {
    try {
      setMorePopularLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/top?page=${page}&limit=20`);
      const data: AnimeResponse = await response.json();
      
      if (page === 1) {
        setMorePopularAnime(data.results || []);
      } else {
        setMorePopularAnime(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMorePages(data.page < data.total_pages);
    } catch (error) {
      console.error('Error fetching more popular anime:', error);
    } finally {
      setMorePopularLoading(false);
    }
  };

  // Handle load more popular anime
  const handleLoadMorePopular = () => {
    setShowMorePopular(true);
    setMorePopularPage(1);
    fetchMorePopularAnime(1);
  };

  // Handle infinite scroll in more popular page
  const handleLoadNextPage = () => {
    if (!morePopularLoading && hasMorePages) {
      const nextPage = morePopularPage + 1;
      setMorePopularPage(nextPage);
      fetchMorePopularAnime(nextPage);
    }
  };

  // Handle opening watch website
  const handleWatchAnime = async () => {
    try {
      const canOpen = await Linking.canOpenURL('https://witanime.red/');
      if (canOpen) {
        await Linking.openURL('https://witanime.red/');
      } else {
        Alert.alert('خطأ', 'غير قادر على فتح الموقع');
      }
    } catch (error) {
      Alert.alert('خطأ', 'غير قادر على فتح الموقع');
    }
  };

  // Handle search input
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (showSearch) {
        searchAnime(searchQuery);
      }
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, showSearch]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPopularAnime(),
        fetchSeasonalAnime()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPopularAnime(),
      fetchSeasonalAnime()
    ]);
    setRefreshing(false);
  };

  // Render anime card for horizontal scroll
  const renderAnimeCard = ({ item, index }: { item: Anime; index: number }) => (
    <TouchableOpacity
      style={styles.animeCard}
      onPress={() => {
        setSelectedAnime(item);
        setShowDetails(true);
      }}
      activeOpacity={0.8}
    >
      <Image
        source={{ 
          uri: item.poster_path 
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
            : 'https://via.placeholder.com/200x300/333/fff?text=No+Image'
        }}
        style={styles.animeImage}
        resizeMode="cover"
      />
      
      {/* Rating Badge */}
      {item.vote_average && (
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
        </View>
      )}
      
      <View style={styles.animeCardInfo}>
        <Text style={styles.animeCardTitle} numberOfLines={2}>
          {item.title_arabic || item.title || item.original_title}
        </Text>
        
        <View style={styles.animeCardMeta}>
          <Text style={styles.episodeCount}>
            {item.episode_count ? `${item.episode_count} حلقة` : 
             item.content_type === 'movie' ? 'فيلم' : 'مسلسل'}
          </Text>
          <Text style={styles.animeStatus}>{item.status || 'متاح'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render anime card for grid (used in more popular/seasonal modals)
  const renderMoreAnimeCard = ({ item, index }: { item: Anime; index: number }) => (
    <TouchableOpacity
      style={[
        styles.moreAnimeCard,
        index % 2 === 0 ? styles.leftCard : styles.rightCard
      ]}
      onPress={() => {
        setSelectedAnime(item);
        setShowDetails(true);
      }}
      activeOpacity={0.8}
    >
      <Image
        source={{ 
          uri: item.poster_path 
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
            : 'https://via.placeholder.com/200x300/333/fff?text=No+Image'
        }}
        style={styles.moreAnimeImage}
        resizeMode="cover"
      />
      
      {/* Rating Badge */}
      {item.vote_average && (
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
        </View>
      )}
      
      <View style={styles.animeCardInfo}>
        <Text style={styles.animeCardTitle} numberOfLines={2}>
          {item.title_arabic || item.title || item.original_title}
        </Text>
        
        <View style={styles.animeCardMeta}>
          <Text style={styles.episodeCount}>
            {item.episode_count ? `${item.episode_count} حلقة` : 
             item.content_type === 'movie' ? 'فيلم' : 'مسلسل'}
          </Text>
          <Text style={styles.animeStatus}>{item.status || 'متاح'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render featured anime hero section
  const renderHeroSection = () => {
    if (!featuredAnime) return null;

    return (
      <View style={styles.heroSection}>
        <Image
          source={{ 
            uri: featuredAnime.backdrop_path 
              ? `https://image.tmdb.org/t/p/w780${featuredAnime.backdrop_path}` 
              : `https://image.tmdb.org/t/p/w500${featuredAnime.poster_path}`
          }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        
        <View style={styles.heroOverlay}>
          <View style={styles.heroContent}>
            <Text style={styles.heroCategory}>أنيمي مميز</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {featuredAnime.title_arabic || featuredAnime.title || featuredAnime.original_title}
            </Text>
            
            <View style={styles.heroMeta}>
              <View style={styles.heroRating}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.heroRatingText}>
                  {featuredAnime.vote_average?.toFixed(1) || 'N/A'}
                </Text>
              </View>
              <Text style={styles.heroEpisodes}>
                {featuredAnime.episode_count ? `${featuredAnime.episode_count} حلقة` : 
                 featuredAnime.content_type === 'movie' ? 'فيلم أنيمي' : 'مسلسل أنيمي'}
              </Text>
            </View>
            
            <Text style={styles.heroDescription} numberOfLines={3}>
              {featuredAnime.overview_arabic || featuredAnime.overview || 'لا يوجد وصف متاح'}
            </Text>
            
            <TouchableOpacity
              style={styles.watchButton}
              onPress={handleWatchAnime}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.watchButtonText}>شاهد الآن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render section header
  const renderSectionHeader = (title: string, onLoadMore?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onLoadMore && (
        <TouchableOpacity onPress={onLoadMore} style={styles.loadMoreButton}>
          <Text style={styles.loadMoreText}>تحميل مزيد</Text>
          <Ionicons name="chevron-back" size={16} color="#FFD700" />
        </TouchableOpacity>
      )}
    </View>
  );

  // Render anime details modal
  const renderAnimeDetails = () => {
    if (!selectedAnime) return null;

    return (
      <View style={styles.detailsOverlay}>
        <View style={styles.detailsContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetails(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            
            <Image
              source={{ 
                uri: selectedAnime.backdrop_path 
                  ? `https://image.tmdb.org/t/p/w780${selectedAnime.backdrop_path}` 
                  : selectedAnime.poster_path 
                    ? `https://image.tmdb.org/t/p/w500${selectedAnime.poster_path}`
                    : 'https://via.placeholder.com/780x440/333/fff?text=No+Image'
              }}
              style={styles.detailsImage}
              resizeMode="cover"
            />
            
            <View style={styles.detailsContent}>
              <Text style={styles.detailsTitle}>
                {selectedAnime.title_arabic || selectedAnime.title || selectedAnime.original_title}
              </Text>
              
              <View style={styles.detailsMetadata}>
                <View style={styles.detailsScoreContainer}>
                  <Ionicons name="star" size={18} color="#FFD700" />
                  <Text style={styles.detailsScoreText}>
                    {selectedAnime.vote_average ? selectedAnime.vote_average.toFixed(1) : 'غير متاح'}
                  </Text>
                </View>
                <Text style={styles.detailsEpisodeText}>
                  {selectedAnime.episode_count ? `${selectedAnime.episode_count} حلقة` : 
                   selectedAnime.content_type === 'movie' ? 'فيلم أنيمي' : 'مسلسل أنيمي'}
                </Text>
              </View>
              
              <Text style={styles.detailsStatus}>{selectedAnime.status || 'غير محدد'}</Text>
              
              {(selectedAnime.release_date || selectedAnime.first_air_date) && (
                <Text style={styles.detailsAired}>
                  تاريخ العرض: {selectedAnime.release_date || selectedAnime.first_air_date}
                </Text>
              )}
              
              {selectedAnime.overview && (
                <View style={styles.synopsisContainer}>
                  <Text style={styles.synopsisTitle}>القصة</Text>
                  <Text style={styles.synopsisText}>
                    {selectedAnime.overview_arabic || selectedAnime.overview}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                style={styles.detailsWatchButton}
                onPress={handleWatchAnime}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={24} color="#fff" />
                <Text style={styles.detailsWatchButtonText}>شاهد الآن</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  if (loading || !fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={[styles.loadingText, { fontFamily: 'Tajawal_400Regular' }]}>جاري تحميل الأنيمي...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>cimaroom</Text>
        
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Section */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن الأنيمي..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity
              onPress={() => {
                setShowSearch(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FFD700']}
            tintColor="#FFD700"
          />
        }
      >
        {/* Search Results */}
        {showSearch && searchResults.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader('نتائج البحث')}
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContainer}
            >
              {searchResults.map((item, index) => (
                <View key={item.id} style={{ flexDirection: 'row' }}>
                  {renderAnimeCard({ item, index })}
                  {index < searchResults.length - 1 && <View style={styles.cardSeparator} />}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Hero Section */}
        {!showSearch && renderHeroSection()}

        {/* Popular Anime Section */}
        {!showSearch && popularAnime.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader('الأكثر شعبية', handleLoadMorePopular)}
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContainer}
            >
              {popularAnime.slice(1, 7).map((item, index) => (
                <View key={item.id} style={{ flexDirection: 'row' }}>
                  {renderAnimeCard({ item, index })}
                  {index < popularAnime.slice(1, 7).length - 1 && <View style={styles.cardSeparator} />}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Seasonal Anime Section */}
        {!showSearch && seasonalAnime.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader('أنميات الموسم', handleLoadMoreSeasonal)}
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContainer}
            >
              {seasonalAnime.map((item, index) => (
                <View key={item.id} style={{ flexDirection: 'row' }}>
                  {renderAnimeCard({ item, index })}
                  {index < seasonalAnime.length - 1 && <View style={styles.cardSeparator} />}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty State */}
        {!showSearch && popularAnime.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>لا توجد أنيمي متاحة</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#FFD700" />
          <Text style={styles.navText}>الرئيسية</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="bookmark-outline" size={24} color="#666" />
          <Text style={[styles.navText, styles.inactiveNavText]}>المفضلة</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person-outline" size={24} color="#666" />
          <Text style={[styles.navText, styles.inactiveNavText]}>الملف الشخصي</Text>
        </TouchableOpacity>
      </View>

      {/* Details Modal */}
      {showDetails && renderAnimeDetails()}

      {/* More Popular Modal */}
      {showMorePopular && (
        <View style={styles.morePopularContainer}>
          <SafeAreaView style={styles.morePopularSafeArea}>
            {/* Header */}
            <View style={styles.morePopularHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowMorePopular(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.morePopularTitle}>الأنيمي الأكثر شعبية</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Content */}
            <FlatList
              data={morePopularAnime}
              renderItem={renderMoreAnimeCard}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              contentContainerStyle={styles.morePopularList}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadNextPage}
              onEndReachedThreshold={0.1}
              ListFooterComponent={
                morePopularLoading ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.loadingText}>جاري تحميل المزيد...</Text>
                  </View>
                ) : !hasMorePages ? (
                  <View style={styles.endOfListFooter}>
                    <Text style={styles.endOfListText}>لا يوجد المزيد من الأنيمي</Text>
                  </View>
                ) : null
              }
            />
          </SafeAreaView>
        </View>
      )}

      {/* More Seasonal Modal */}
      {showMoreSeasonal && (
        <View style={styles.morePopularContainer}>
          <SafeAreaView style={styles.morePopularSafeArea}>
            {/* Header */}
            <View style={styles.morePopularHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowMoreSeasonal(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.morePopularTitle}>أنميات الموسم</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Content */}
            <FlatList
              data={moreSeasonalAnime}
              renderItem={renderMoreAnimeCard}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              contentContainerStyle={styles.morePopularList}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadSeasonalNextPage}
              onEndReachedThreshold={0.1}
              ListFooterComponent={
                moreSeasonalLoading ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.loadingText}>جاري تحميل المزيد...</Text>
                  </View>
                ) : !hasMoreSeasonalPages ? (
                  <View style={styles.endOfListFooter}>
                    <Text style={styles.endOfListText}>لا يوجد المزيد من أنميات الموسم</Text>
                  </View>
                ) : null
              }
            />
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Tajawal_400Regular',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1A1A1A',
  },
  searchButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    fontFamily: 'Tajawal_700Bold',
  },
  menuButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#1A1A1A',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Tajawal_400Regular',
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: screenWidth,
    height: 280,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  heroContent: {
    flex: 1,
  },
  heroCategory: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
    fontFamily: 'Tajawal_500Medium',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 28,
    fontFamily: 'Tajawal_700Bold',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  heroRatingText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'Tajawal_500Medium',
  },
  heroEpisodes: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
  },
  heroDescription: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
    fontFamily: 'Tajawal_400Regular',
  },
  watchButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  watchButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    fontFamily: 'Tajawal_700Bold',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Tajawal_700Bold',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
    fontFamily: 'Tajawal_500Medium',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
    fontFamily: 'Tajawal_500Medium',
  },
  gridContainer: {
    paddingHorizontal: 15,
  },
  horizontalScrollContainer: {
    paddingHorizontal: 20,
    paddingRight: 40, // Extra padding for right edge
    flexDirection: 'row',
  },
  cardSeparator: {
    width: 15, // Space between cards in horizontal scroll
  },
  animeCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    width: 140, // Fixed width for horizontal scroll
  },
  leftCard: {
    marginRight: 7.5,
    flex: 1,
  },
  rightCard: {
    marginLeft: 7.5,
    flex: 1,
  },
  animeImage: {
    width: '100%',
    height: 180, // Adjusted height for horizontal cards
    backgroundColor: '#333',
  },
  moreAnimeCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
  },
  moreAnimeImage: {
    width: '100%',
    height: 200, // Original height for grid view
    backgroundColor: '#333',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'Tajawal_500Medium',
  },
  animeCardInfo: {
    padding: 12,
  },
  animeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
    lineHeight: 18,
    fontFamily: 'Tajawal_500Medium',
  },
  animeCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  episodeCount: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Tajawal_400Regular',
  },
  animeStatus: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '500',
    fontFamily: 'Tajawal_500Medium',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  navText: {
    fontSize: 10,
    color: '#FFD700',
    marginTop: 4,
    fontWeight: '600',
    fontFamily: 'Tajawal_500Medium',
  },
  inactiveNavText: {
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Tajawal_400Regular',
  },
  detailsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    width: screenWidth * 0.95,
    maxHeight: '90%',
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 8,
  },
  detailsImage: {
    width: '100%',
    height: 250,
  },
  detailsContent: {
    padding: 20,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    lineHeight: 28,
    fontFamily: 'Tajawal_700Bold',
  },
  detailsMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailsScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsScoreText: {
    marginLeft: 6,
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
    fontFamily: 'Tajawal_500Medium',
  },
  detailsEpisodeText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Tajawal_400Regular',
  },
  detailsStatus: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '500',
    marginBottom: 8,
    fontFamily: 'Tajawal_500Medium',
  },
  detailsAired: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
    fontFamily: 'Tajawal_400Regular',
  },
  synopsisContainer: {
    marginBottom: 20,
  },
  synopsisTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Tajawal_500Medium',
  },
  synopsisText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 22,
    fontFamily: 'Tajawal_400Regular',
  },
  detailsWatchButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
  },
  detailsWatchButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    fontFamily: 'Tajawal_700Bold',
  },
  morePopularContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F0F0F',
    zIndex: 1000,
  },
  morePopularSafeArea: {
    flex: 1,
  },
  morePopularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  morePopularTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Tajawal_700Bold',
  },
  morePopularList: {
    padding: 15,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    color: '#999',
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: 'Tajawal_400Regular',
  },
  headerSpacer: {
    width: 40, // Same as back button to center the title
  },
});