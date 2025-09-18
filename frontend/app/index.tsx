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
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

const { width: screenWidth } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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
  audience_rating?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  episode_count?: number;
  status?: string;
  genres?: Array<{ id: number; name: string; name_arabic: string }>;
  cast?: Array<{
    id: number;
    name: string;
    character: string;
    character_arabic: string;
    profile_path?: string;
    popularity: number;
  }>;
  recommendations?: Array<{
    id: number;
    title: string;
    poster_path?: string;
    vote_average?: number;
    overview_arabic?: string;
    content_type: string;
  }>;
  origin_country?: string[];
  content_type: string;
  anime_confidence?: number;
}

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday?: string;
  deathday?: string;
  place_of_birth?: string;
  profile_path?: string;
  popularity: number;
  known_for_department: string;
  known_for_anime: Array<{
    id: number;
    title: string;
    character: string;
    poster_path?: string;
    vote_average?: number;
    content_type: string;
  }>;
}

interface AnimeResponse {
  results: Anime[];
  page: number;
  total_pages: number;
  total_results: number;
}

export default function Index() {
  const router = useRouter();
  const [popularAnime, setPopularAnime] = useState<Anime[]>([]);
  const [seasonalAnime, setSeasonalAnime] = useState<Anime[]>([]);
  const [topRatedAnime, setTopRatedAnime] = useState<Anime[]>([]);
  const [animeMovies, setAnimeMovies] = useState<Anime[]>([]);
  const [featuredAnime, setFeaturedAnime] = useState<Anime[]>([]); // Changed to array for slider
  const [currentSlide, setCurrentSlide] = useState(0); // For slider navigation
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
  
  // Cast and person details states
  const [selectedPerson, setSelectedPerson] = useState<PersonDetails | null>(null);
  const [showPersonDetails, setShowPersonDetails] = useState(false);
  const [personLoading, setPersonLoading] = useState(false);
  
  // Enhanced anime details states
  const [animeDetailsLoading, setAnimeDetailsLoading] = useState(false);
  const [detailedAnime, setDetailedAnime] = useState<Anime | null>(null);
  
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

  // Fetch popular anime and set featured anime slider
  const fetchPopularAnime = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/top?limit=10`);
      const data: AnimeResponse = await response.json();
      const animeList = data.results || [];
      setPopularAnime(animeList);
      
      // Set top 5 anime for featured slider
      if (animeList.length > 0) {
        setFeaturedAnime(animeList.slice(0, 5));
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

  // Fetch anime movies
  const fetchAnimeMovies = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/movies?limit=8`);
      const data: AnimeResponse = await response.json();
      setAnimeMovies(data.results || []);
    } catch (error) {
      console.error('Error fetching anime movies:', error);
    }
  };

  // Remove fetchAnimeSchedule function completely
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
      console.log(`Fetching seasonal anime page ${page}`);
      const response = await fetch(`${BACKEND_URL}/api/anime/current-season?page=${page}&limit=20`);
      const data: AnimeResponse = await response.json();
      console.log(`Fetched seasonal anime:`, data);
      
      if (page === 1) {
        setMoreSeasonalAnime(data.results || []);
      } else {
        setMoreSeasonalAnime(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMoreSeasonalPages(data.page < data.total_pages);
      console.log(`Has more seasonal pages: ${data.page < data.total_pages}`);
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

  // Fetch more anime movies for infinite scroll
  const fetchMoreMoviesAnime = async (page: number = 1) => {
    try {
      setMoreMoviesLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/movies?page=${page}&limit=20`);
      const data: AnimeResponse = await response.json();
      
      if (page === 1) {
        setMoreMoviesAnime(data.results || []);
      } else {
        setMoreMoviesAnime(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMoreMoviesPages(data.page < data.total_pages);
    } catch (error) {
      console.error('Error fetching more anime movies:', error);
    } finally {
      setMoreMoviesLoading(false);
    }
  };

  // Handle load more anime movies
  const handleLoadMoreMovies = () => {
    setShowMoreMovies(true);
    setMoreMoviesPage(1);
    fetchMoreMoviesAnime(1);
  };

  // Handle infinite scroll in more movies page
  const handleLoadMoviesNextPage = () => {
    if (!moreMoviesLoading && hasMoreMoviesPages) {
      const nextPage = moreMoviesPage + 1;
      setMoreMoviesPage(nextPage);
      fetchMoreMoviesAnime(nextPage);
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

  // Fetch detailed anime information
  const fetchAnimeDetails = async (animeId: number, contentType: string) => {
    try {
      setAnimeDetailsLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/${animeId}/details?content_type=${contentType}`);
      const data: Anime = await response.json();
      setDetailedAnime(data);
      return data;
    } catch (error) {
      console.error('Error fetching anime details:', error);
      return null;
    } finally {
      setAnimeDetailsLoading(false);
    }
  };

  // Fetch person details
  const fetchPersonDetails = async (personId: number) => {
    try {
      setPersonLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/person/${personId}`);
      const data: PersonDetails = await response.json();
      setSelectedPerson(data);
      setShowPersonDetails(true);
    } catch (error) {
      console.error('Error fetching person details:', error);
      Alert.alert('خطأ', 'لا يمكن تحميل تفاصيل الممثل');
    } finally {
      setPersonLoading(false);
    }
  };

  // Handle anime selection with enhanced details
  const handleAnimeSelection = async (anime: Anime) => {
    setSelectedAnime(anime);
    setShowDetails(true);
    
    // Fetch detailed information in background
    const detailedData = await fetchAnimeDetails(anime.id, anime.content_type);
    if (detailedData) {
      setDetailedAnime(detailedData);
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
        fetchSeasonalAnime(),
        fetchAnimeMovies()
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
      fetchSeasonalAnime(),
      fetchAnimeMovies()
    ]);
    setRefreshing(false);
  };

  // Render anime card for horizontal scroll
  const renderAnimeCard = ({ item, index }: { item: Anime; index: number }) => (
    <TouchableOpacity
      style={styles.animeCard}
      onPress={() => handleAnimeSelection(item)}
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
          {item.title_arabic || item.title || 'بدون عنوان'}
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
        // Close the current modal first, then show details
        setShowMorePopular(false);
        setShowMoreSeasonal(false);
        setShowMoreMovies(false);
        
        // Small delay to ensure modal is closed before showing details
        setTimeout(() => {
          handleAnimeSelection(item);
        }, 100);
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
          {item.title_arabic || item.title || 'بدون عنوان'}
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

  // Render featured anime slider hero section
  const renderHeroSection = () => {
    if (featuredAnime.length === 0) return null;

    const currentAnime = featuredAnime[currentSlide];

    return (
      <View style={styles.heroSection}>
        <Image
          source={{ 
            uri: currentAnime.backdrop_path 
              ? `https://image.tmdb.org/t/p/w780${currentAnime.backdrop_path}` 
              : `https://image.tmdb.org/t/p/w500${currentAnime.poster_path}`
          }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        
        <View style={styles.heroOverlay}>
          <View style={styles.heroContent}>
            <Text style={styles.heroCategory}>أنيمي مميز</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {currentAnime.title_arabic || currentAnime.title || 'بدون عنوان'}
            </Text>
            
            <View style={styles.heroMeta}>
              <View style={styles.heroRating}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.heroRatingText}>
                  {currentAnime.vote_average?.toFixed(1) || 'N/A'}
                </Text>
              </View>
              <Text style={styles.heroEpisodes}>
                {currentAnime.episode_count ? `${currentAnime.episode_count} حلقة` : 
                 currentAnime.content_type === 'movie' ? 'فيلم أنيمي' : 'مسلسل أنيمي'}
              </Text>
            </View>
            
            <Text style={styles.heroDescription} numberOfLines={3}>
              {currentAnime.overview_arabic || currentAnime.overview || 'لا يوجد وصف متاح'}
            </Text>
            
            <View style={styles.heroButtons}>
              <TouchableOpacity
                style={styles.watchButton}
                onPress={() => handleAnimeSelection(currentAnime)}
                activeOpacity={0.8}
              >
                <Ionicons name="information-circle-outline" size={20} color="#FFD700" />
                <Text style={styles.watchButtonText}>شاهد التفاصيل</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Slider Navigation Dots */}
        <View style={styles.sliderDotsContainer}>
          {featuredAnime.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.sliderDot,
                index === currentSlide && styles.sliderDotActive
              ]}
              onPress={() => setCurrentSlide(index)}
            />
          ))}
        </View>
        
        {/* Navigation Arrows */}
        <TouchableOpacity
          style={styles.sliderArrowLeft}
          onPress={() => setCurrentSlide(currentSlide > 0 ? currentSlide - 1 : featuredAnime.length - 1)}
        >
          <Ionicons name="chevron-back" size={30} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.sliderArrowRight}
          onPress={() => setCurrentSlide(currentSlide < featuredAnime.length - 1 ? currentSlide + 1 : 0)}
        >
          <Ionicons name="chevron-forward" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render section header with RTL layout
  const renderSectionHeader = (title: string, onLoadMore?: () => void) => (
    <View style={[styles.sectionHeader, { flexDirection: 'row-reverse' }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onLoadMore && (
        <TouchableOpacity onPress={onLoadMore} style={styles.loadMoreButton}>
          <Ionicons name="chevron-forward" size={16} color="#FFD700" />
          <Text style={styles.loadMoreText}>تحميل مزيد</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render anime details modal
  const renderAnimeDetails = () => {
    if (!selectedAnime) return null;
    
    const currentAnimeData = detailedAnime || selectedAnime;

    return (
      <View style={styles.detailsOverlay}>
        <View style={styles.detailsContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowDetails(false);
                setDetailedAnime(null);
              }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            
            <Image
              source={{ 
                uri: currentAnimeData.backdrop_path 
                  ? `https://image.tmdb.org/t/p/w780${currentAnimeData.backdrop_path}` 
                  : currentAnimeData.poster_path 
                    ? `https://image.tmdb.org/t/p/w500${currentAnimeData.poster_path}`
                    : 'https://via.placeholder.com/780x440/333/fff?text=No+Image'
              }}
              style={styles.detailsImage}
              resizeMode="cover"
            />
            
            <View style={styles.detailsContent}>
              <Text style={styles.detailsTitle}>
                {currentAnimeData.title_arabic || currentAnimeData.title || 'بدون عنوان'}
              </Text>
              
              {/* Ratings Section */}
              <View style={styles.ratingsContainer}>
                <View style={styles.detailsScoreContainer}>
                  <Ionicons name="star" size={18} color="#FFD700" />
                  <Text style={styles.detailsScoreText}>
                    {currentAnimeData.vote_average ? currentAnimeData.vote_average.toFixed(1) : 'غير متاح'}
                  </Text>
                  <Text style={styles.ratingLabel}>تقييم رسمي</Text>
                </View>
                
                {currentAnimeData.audience_rating && (
                  <View style={styles.detailsScoreContainer}>
                    <Ionicons name="people" size={18} color="#4CAF50" />
                    <Text style={[styles.detailsScoreText, { color: '#4CAF50' }]}>
                      {currentAnimeData.audience_rating.toFixed(1)}
                    </Text>
                    <Text style={styles.ratingLabel}>تقييم الجمهور</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.detailsMetadata}>
                <Text style={styles.detailsEpisodeText}>
                  {currentAnimeData.episode_count ? `${currentAnimeData.episode_count} حلقة` : 
                   currentAnimeData.content_type === 'movie' ? 'فيلم أنيمي' : 'مسلسل أنيمي'}
                </Text>
                <Text style={styles.detailsVoteCount}>
                  {currentAnimeData.vote_count ? `${currentAnimeData.vote_count} تقييم` : ''}
                </Text>
              </View>
              
              <Text style={styles.detailsStatus}>{currentAnimeData.status || 'غير محدد'}</Text>
              
              {(currentAnimeData.release_date || currentAnimeData.first_air_date) && (
                <Text style={styles.detailsAired}>
                  تاريخ العرض: {currentAnimeData.release_date || currentAnimeData.first_air_date}
                </Text>
              )}
              
              {/* Genres Section */}
              {currentAnimeData.genres && currentAnimeData.genres.length > 0 && (
                <View style={styles.genresContainer}>
                  <Text style={styles.sectionSubTitle}>التصنيفات</Text>
                  <View style={styles.genresList}>
                    {currentAnimeData.genres.map((genre, index) => (
                      <View key={genre.id} style={styles.genreTag}>
                        <Text style={styles.genreText}>
                          {genre.name_arabic || genre.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Synopsis Section */}
              {currentAnimeData.overview && (
                <View style={styles.synopsisContainer}>
                  <Text style={styles.synopsisTitle}>القصة</Text>
                  <Text style={styles.synopsisText}>
                    {currentAnimeData.overview_arabic || currentAnimeData.overview}
                  </Text>
                </View>
              )}
              
              {/* Cast Section */}
              {currentAnimeData.cast && currentAnimeData.cast.length > 0 && (
                <View style={styles.castContainer}>
                  <Text style={styles.sectionSubTitle}>طاقم العمل</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.castList}>
                      {currentAnimeData.cast.slice(0, 8).map((member, index) => (
                        <TouchableOpacity
                          key={member.id}
                          style={styles.castCard}
                          onPress={() => fetchPersonDetails(member.id)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{
                              uri: member.profile_path
                                ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
                                : 'https://via.placeholder.com/100x150/333/fff?text=No+Image'
                            }}
                            style={styles.castImage}
                            resizeMode="cover"
                          />
                          <Text style={styles.castName} numberOfLines={2}>
                            {member.name}
                          </Text>
                          <Text style={styles.castCharacter} numberOfLines={2}>
                            {member.character_arabic || member.character}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
              
              {/* Recommendations Section */}
              {currentAnimeData.recommendations && currentAnimeData.recommendations.length > 0 && (
                <View style={styles.recommendationsContainer}>
                  <Text style={styles.sectionSubTitle}>اقتراحات مشابهة</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.recommendationsList}>
                      {currentAnimeData.recommendations.slice(0, 6).map((rec, index) => (
                        <TouchableOpacity
                          key={rec.id}
                          style={styles.recommendationCard}
                          onPress={() => {
                            setShowDetails(false);
                            setDetailedAnime(null);
                            setTimeout(() => {
                              handleAnimeSelection({
                                ...rec,
                                title_arabic: rec.title,
                                overview_arabic: rec.overview_arabic
                              });
                            }, 100);
                          }}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{
                              uri: rec.poster_path
                                ? `https://image.tmdb.org/t/p/w300${rec.poster_path}`
                                : 'https://via.placeholder.com/120x180/333/fff?text=No+Image'
                            }}
                            style={styles.recommendationImage}
                            resizeMode="cover"
                          />
                          <Text style={styles.recommendationTitle} numberOfLines={2}>
                            {rec.title}
                          </Text>
                          {rec.vote_average && (
                            <View style={styles.recommendationRating}>
                              <Ionicons name="star" size={12} color="#FFD700" />
                              <Text style={styles.recommendationRatingText}>
                                {rec.vote_average.toFixed(1)}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
              
              {animeDetailsLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFD700" />
                  <Text style={styles.loadingText}>جاري تحميل التفاصيل...</Text>
                </View>
              )}
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
        <>
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

          {/* Hero Section with Slider */}
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
                {popularAnime.slice(5, 11).map((item, index) => (
                  <View key={item.id} style={{ flexDirection: 'row' }}>
                    {renderAnimeCard({ item, index })}
                    {index < popularAnime.slice(5, 11).length - 1 && <View style={styles.cardSeparator} />}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Fall 2025 Anime Section */}
          {!showSearch && seasonalAnime.length > 0 && (
            <View style={styles.section}>
              {renderSectionHeader('أنميات خريف 2025', handleLoadMoreSeasonal)}
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

          {/* Anime Movies Section */}
          {!showSearch && animeMovies.length > 0 && (
            <View style={styles.section}>
              {renderSectionHeader('أفلام الأنيمي', handleLoadMoreMovies)}
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContainer}
              >
                {animeMovies.map((item, index) => (
                  <View key={item.id} style={{ flexDirection: 'row' }}>
                    {renderAnimeCard({ item, index })}
                    {index < animeMovies.length - 1 && <View style={styles.cardSeparator} />}
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
        </>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/news')}
        >
          <Ionicons name="newspaper-outline" size={24} color="#666" />
          <Text style={[styles.navText, styles.inactiveNavText]}>الأخبار</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/lists')}
        >
          <Ionicons name="list-outline" size={24} color="#666" />
          <Text style={[styles.navText, styles.inactiveNavText]}>القوائم</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => {
            setShowSearch(false);
          }}
        >
          <Ionicons name="home" size={24} color={!showSearch ? "#FFD700" : "#666"} />
          <Text style={[styles.navText, showSearch && styles.inactiveNavText]}>الرئيسية</Text>
        </TouchableOpacity>
      </View>

      {/* Details Modal */}
      {showDetails && renderAnimeDetails()}

      {/* Person Details Modal */}
      {showPersonDetails && selectedPerson && (
        <View style={styles.detailsOverlay}>
          <View style={styles.detailsContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowPersonDetails(false);
                  setSelectedPerson(null);
                }}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.personDetailsContent}>
                <Image
                  source={{
                    uri: selectedPerson.profile_path
                      ? `https://image.tmdb.org/t/p/w300${selectedPerson.profile_path}`
                      : 'https://via.placeholder.com/200x300/333/fff?text=No+Image'
                  }}
                  style={styles.personImage}
                  resizeMode="cover"
                />
                
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>
                    {selectedPerson.name}
                  </Text>
                  
                  <Text style={styles.personDepartment}>
                    {selectedPerson.known_for_department === 'Acting' ? 'ممثل' : selectedPerson.known_for_department}
                  </Text>
                  
                  {selectedPerson.place_of_birth && (
                    <Text style={styles.personBirthplace}>
                      مكان الولادة: {selectedPerson.place_of_birth}
                    </Text>
                  )}
                  
                  {selectedPerson.birthday && (
                    <Text style={styles.personBirthday}>
                      تاريخ الولادة: {selectedPerson.birthday}
                    </Text>
                  )}
                  
                  {selectedPerson.biography && (
                    <View style={styles.biographyContainer}>
                      <Text style={styles.biographyTitle}>نبذة</Text>
                      <Text style={styles.biographyText} numberOfLines={6}>
                        {selectedPerson.biography}
                      </Text>
                    </View>
                  )}
                  
                  {selectedPerson.known_for_anime && selectedPerson.known_for_anime.length > 0 && (
                    <View style={styles.knownForContainer}>
                      <Text style={styles.knownForTitle}>أعمال مشهورة</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.knownForList}>
                          {selectedPerson.known_for_anime.slice(0, 6).map((work, index) => (
                            <TouchableOpacity
                              key={work.id}
                              style={styles.knownForCard}
                              onPress={() => {
                                setShowPersonDetails(false);
                                setSelectedPerson(null);
                                setTimeout(() => {
                                  handleAnimeSelection({
                                    ...work,
                                    title_arabic: work.title,
                                    overview_arabic: ''
                                  });
                                }, 100);
                              }}
                              activeOpacity={0.8}
                            >
                              <Image
                                source={{
                                  uri: work.poster_path
                                    ? `https://image.tmdb.org/t/p/w154${work.poster_path}`
                                    : 'https://via.placeholder.com/80x120/333/fff?text=No+Image'
                                }}
                                style={styles.knownForImage}
                                resizeMode="cover"
                              />
                              <Text style={styles.knownForWorkTitle} numberOfLines={2}>
                                {work.title}
                              </Text>
                              {work.character && (
                                <Text style={styles.knownForCharacter} numberOfLines={1}>
                                  {work.character}
                                </Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
              
              {personLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFD700" />
                  <Text style={styles.loadingText}>جاري تحميل المعلومات...</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

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

      {/* More Fall 2025 Anime Modal */}
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
              <Text style={styles.morePopularTitle}>أنميات خريف 2025</Text>
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
                    <Text style={styles.endOfListText}>لا يوجد المزيد من أنميات خريف 2025</Text>
                  </View>
                ) : null
              }
            />
          </SafeAreaView>
        </View>
      )}

      {/* More Anime Movies Modal */}
      {showMoreMovies && (
        <View style={styles.morePopularContainer}>
          <SafeAreaView style={styles.morePopularSafeArea}>
            {/* Header */}
            <View style={styles.morePopularHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowMoreMovies(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.morePopularTitle}>أفلام الأنيمي</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Content */}
            <FlatList
              data={moreMoviesAnime}
              renderItem={renderMoreAnimeCard}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              contentContainerStyle={styles.morePopularList}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMoviesNextPage}
              onEndReachedThreshold={0.1}
              ListFooterComponent={
                moreMoviesLoading ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.loadingText}>جاري تحميل المزيد...</Text>
                  </View>
                ) : !hasMoreMoviesPages ? (
                  <View style={styles.endOfListFooter}>
                    <Text style={styles.endOfListText}>لا يوجد المزيد من أفلام الأنيمي</Text>
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
  heroButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  infoButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  infoButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Tajawal_500Medium',
  },
  sliderDotsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  sliderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  sliderDotActive: {
    backgroundColor: '#FFD700',
    width: 20,
  },
  sliderArrowLeft: {
    position: 'absolute',
    left: 15,
    top: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    marginTop: -20,
  },
  sliderArrowRight: {
    position: 'absolute',
    right: 15,
    top: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    marginTop: -20,
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
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
  schedulePage: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scheduleHeader: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  scheduleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    fontFamily: 'Tajawal_700Bold',
  },
  scheduleSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    fontFamily: 'Tajawal_400Regular',
  },
  scheduleContent: {
    flex: 1,
  },
  daySection: {
    marginBottom: 25,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1A1A1A',
    marginBottom: 10,
  },
  dayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    fontFamily: 'Tajawal_700Bold',
  },
  dayNameEn: {
    fontSize: 14,
    color: '#999',
    textTransform: 'uppercase',
    fontFamily: 'Tajawal_400Regular',
  },
  scheduleAnimeCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  scheduleAnimeImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  scheduleAnimeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  scheduleAnimeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
    fontFamily: 'Tajawal_500Medium',
  },
  scheduleAnimeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scheduleTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  scheduleTime: {
    fontSize: 12,
    color: '#FFD700',
    marginLeft: 4,
    fontFamily: 'Tajawal_400Regular',
  },
  scheduleEpisodes: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Tajawal_400Regular',
  },
  scheduleStudio: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Tajawal_400Regular',
  },
  scheduleRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleScore: {
    fontSize: 12,
    color: '#FFD700',
    marginLeft: 4,
    fontFamily: 'Tajawal_400Regular',
  },
  emptySchedule: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyScheduleText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Tajawal_400Regular',
  },
  
  // Enhanced Details Styles
  ratingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    marginBottom: 15,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#999',
    marginLeft: 5,
    fontFamily: 'Tajawal_400Regular',
  },
  detailsVoteCount: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Tajawal_400Regular',
  },
  
  // Genres Styles
  genresContainer: {
    marginBottom: 20,
  },
  sectionSubTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Tajawal_500Medium',
  },
  genresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Tajawal_500Medium',
  },
  
  // Cast Styles
  castContainer: {
    marginBottom: 20,
  },
  castList: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  castCard: {
    width: 80,
    marginRight: 15,
    alignItems: 'center',
  },
  castImage: {
    width: 70,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  castName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Tajawal_500Medium',
  },
  castCharacter: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'Tajawal_400Regular',
  },
  
  // Recommendations Styles
  recommendationsContainer: {
    marginBottom: 20,
  },
  recommendationsList: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  recommendationCard: {
    width: 120,
    marginRight: 15,
  },
  recommendationImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Tajawal_500Medium',
  },
  recommendationRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationRatingText: {
    fontSize: 12,
    color: '#FFD700',
    marginLeft: 4,
    fontFamily: 'Tajawal_400Regular',
  },
  
  // Person Details Styles
  personDetailsContent: {
    padding: 20,
    alignItems: 'center',
  },
  personImage: {
    width: 150,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#333',
    marginBottom: 20,
  },
  personInfo: {
    width: '100%',
    alignItems: 'center',
  },
  personName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Tajawal_700Bold',
  },
  personDepartment: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
    marginBottom: 10,
    fontFamily: 'Tajawal_500Medium',
  },
  personBirthplace: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
    textAlign: 'center',
    fontFamily: 'Tajawal_400Regular',
  },
  personBirthday: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: 'Tajawal_400Regular',
  },
  biographyContainer: {
    width: '100%',
    marginBottom: 20,
  },
  biographyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Tajawal_500Medium',
  },
  biographyText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 22,
    textAlign: 'right',
    fontFamily: 'Tajawal_400Regular',
  },
  knownForContainer: {
    width: '100%',
    marginBottom: 20,
  },
  knownForTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Tajawal_500Medium',
  },
  knownForList: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  knownForCard: {
    width: 80,
    marginRight: 15,
    alignItems: 'center',
  },
  knownForImage: {
    width: 70,
    height: 105,
    borderRadius: 8,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  knownForWorkTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Tajawal_500Medium',
  },
  knownForCharacter: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'Tajawal_400Regular',
  },
});