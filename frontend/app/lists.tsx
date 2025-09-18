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
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { useRouter } from 'expo-router';

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
  content_type: string;
}

interface FilterOptions {
  content_type: 'all' | 'tv' | 'movie';
  genre: string;
  year: string;
  rating: string;
  status: string;
  sort_by: 'popularity' | 'rating' | 'release_date' | 'title';
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function ListsScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  // State management
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [filteredAnime, setFilteredAnime] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter states
  const [filters, setFilters] = useState<FilterOptions>({
    content_type: 'all',
    genre: 'all',
    year: 'all',
    rating: 'all',
    status: 'all',
    sort_by: 'popularity',
  });

  // Genre options
  const genreOptions = [
    { id: 'all', name: 'الكل', name_arabic: 'الكل' },
    { id: '16', name: 'Animation', name_arabic: 'رسوم متحركة' },
    { id: '28', name: 'Action', name_arabic: 'أكشن' },
    { id: '12', name: 'Adventure', name_arabic: 'مغامرة' },
    { id: '35', name: 'Comedy', name_arabic: 'كوميديا' },
    { id: '18', name: 'Drama', name_arabic: 'دراما' },
    { id: '14', name: 'Fantasy', name_arabic: 'خيال' },
    { id: '27', name: 'Horror', name_arabic: 'رعب' },
    { id: '10749', name: 'Romance', name_arabic: 'رومانسي' },
    { id: '878', name: 'Science Fiction', name_arabic: 'خيال علمي' },
    { id: '53', name: 'Thriller', name_arabic: 'إثارة' },
  ];

  // Year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    'الكل',
    ...Array.from({ length: 20 }, (_, i) => (currentYear - i).toString())
  ];

  // Rating options
  const ratingOptions = [
    { id: 'all', label: 'جميع التقييمات' },
    { id: '9+', label: '9+ ممتاز' },
    { id: '8+', label: '8+ جيد جداً' },
    { id: '7+', label: '7+ جيد' },
    { id: '6+', label: '6+ متوسط' },
  ];

  // Status options
  const statusOptions = [
    { id: 'all', label: 'جميع الحالات' },
    { id: 'Returning Series', label: 'مستمر' },
    { id: 'Ended', label: 'منتهي' },
    { id: 'Released', label: 'مُصدر' },
  ];

  // Sort options
  const sortOptions = [
    { id: 'popularity', label: 'الأكثر شعبية' },
    { id: 'rating', label: 'الأعلى تقييماً' },
    { id: 'release_date', label: 'الأحدث' },
    { id: 'title', label: 'الأبجدية' },
  ];

  // Fetch all anime data
  const fetchAllAnime = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        setAllAnime([]);
      } else {
        setLoadingMore(true);
      }

      // Fetch from multiple sources
      const endpoints = [
        `${BACKEND_URL}/api/anime/top?page=${pageNum}&limit=20`,
        `${BACKEND_URL}/api/anime/movies?page=${pageNum}&limit=10`,
        `${BACKEND_URL}/api/anime/current-season?page=${pageNum}&limit=10`,
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint => 
          fetch(endpoint).then(res => res.json()).catch(() => ({ results: [] }))
        )
      );

      const allResults: Anime[] = [];
      responses.forEach(response => {
        if (response.results && Array.isArray(response.results)) {
          allResults.push(...response.results);
        }
      });

      // Remove duplicates by ID
      const uniqueAnime = allResults.filter((anime, index, self) => 
        index === self.findIndex(a => a.id === anime.id)
      );

      if (append) {
        setAllAnime(prev => [...prev, ...uniqueAnime]);
      } else {
        setAllAnime(uniqueAnime);
      }

      setHasMorePages(uniqueAnime.length >= 20);
      
    } catch (error) {
      console.error('Error fetching anime:', error);
      Alert.alert('خطأ', 'فشل في تحميل البيانات');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Search anime
  const searchAnime = async (query: string) => {
    if (!query.trim()) {
      applyFilters();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/search?q=${encodeURIComponent(query)}&limit=50`);
      const data = await response.json();
      
      if (data.results) {
        setFilteredAnime(data.results);
      }
    } catch (error) {
      console.error('Error searching anime:', error);
      Alert.alert('خطأ', 'فشل في البحث');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const applyFilters = () => {
    let filtered = [...allAnime];

    // Filter by content type
    if (filters.content_type !== 'all') {
      filtered = filtered.filter(anime => anime.content_type === filters.content_type);
    }

    // Filter by genre
    if (filters.genre !== 'all') {
      filtered = filtered.filter(anime => 
        anime.genres?.some(genre => genre.id.toString() === filters.genre)
      );
    }

    // Filter by year
    if (filters.year !== 'all') {
      filtered = filtered.filter(anime => {
        const animeYear = anime.release_date?.substring(0, 4) || anime.first_air_date?.substring(0, 4);
        return animeYear === filters.year;
      });
    }

    // Filter by rating
    if (filters.rating !== 'all') {
      const minRating = parseFloat(filters.rating.replace('+', ''));
      filtered = filtered.filter(anime => (anime.vote_average || 0) >= minRating);
    }

    // Filter by status
    if (filters.status !== 'all' && filters.status !== '') {
      filtered = filtered.filter(anime => anime.status === filters.status);
    }

    // Sort results
    filtered.sort((a, b) => {
      switch (filters.sort_by) {
        case 'rating':
          return (b.vote_average || 0) - (a.vote_average || 0);
        case 'release_date':
          const dateA = a.release_date || a.first_air_date || '1900-01-01';
          const dateB = b.release_date || b.first_air_date || '1900-01-01';
          return dateB.localeCompare(dateA);
        case 'title':
          const titleA = a.title_arabic || a.title || '';
          const titleB = b.title_arabic || b.title || '';
          return titleA.localeCompare(titleB);
        case 'popularity':
        default:
          return (b.popularity || 0) - (a.popularity || 0);
      }
    });

    setFilteredAnime(filtered);
  };

  // Load more data
  const loadMore = () => {
    if (!loadingMore && hasMorePages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchAllAnime(nextPage, true);
    }
  };

  // Handle search input
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery.trim()) {
        searchAnime(searchQuery);
      } else {
        applyFilters();
      }
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Apply filters when filters change
  useEffect(() => {
    if (!searchQuery.trim()) {
      applyFilters();
    }
  }, [filters, allAnime]);

  // Initial data load
  useEffect(() => {
    fetchAllAnime();
  }, []);

  // State for anime details modal
  const [selectedDetailedAnime, setSelectedDetailedAnime] = useState<Anime | null>(null);
  const [showAnimeDetails, setShowAnimeDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Handle anime selection with enhanced details
  const handleAnimeSelection = async (anime: Anime) => {
    try {
      setDetailsLoading(true);
      setSelectedDetailedAnime(anime);
      setShowAnimeDetails(true);
      
      // Fetch detailed information
      const response = await fetch(`${BACKEND_URL}/api/anime/${anime.id}/details?content_type=${anime.content_type}`);
      if (response.ok) {
        const detailedData: Anime = await response.json();
        setSelectedDetailedAnime(detailedData);
      }
    } catch (error) {
      console.error('Error fetching anime details:', error);
      Alert.alert('خطأ', 'لا يمكن تحميل تفاصيل الأنمي');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Render anime card
  const renderAnimeCard = ({ item }: { item: Anime }) => (
    <TouchableOpacity 
      style={styles.animeCard}
      activeOpacity={0.8}
      onPress={() => handleAnimeSelection(item)}
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
        
        {item.genres && item.genres.length > 0 && (
          <View style={styles.genresContainer}>
            {item.genres.slice(0, 2).map((genre, index) => (
              <Text key={genre.id} style={styles.genreTag}>
                {genre.name_arabic || genre.name}
              </Text>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render filter modal
  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>فلترة النتائج</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.filterContent}>
            {/* Content Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>نوع المحتوى</Text>
              <View style={styles.filterOptions}>
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'tv', label: 'مسلسلات' },
                  { id: 'movie', label: 'أفلام' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.filterOption,
                      filters.content_type === option.id && styles.activeFilterOption
                    ]}
                    onPress={() => setFilters({...filters, content_type: option.id as any})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.content_type === option.id && styles.activeFilterOptionText
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Genre Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>التصنيف</Text>
              <View style={styles.filterOptions}>
                {genreOptions.slice(0, 6).map(genre => (
                  <TouchableOpacity
                    key={genre.id}
                    style={[
                      styles.filterOption,
                      filters.genre === genre.id && styles.activeFilterOption
                    ]}
                    onPress={() => setFilters({...filters, genre: genre.id})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.genre === genre.id && styles.activeFilterOptionText
                    ]}>
                      {genre.name_arabic}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Year Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>السنة</Text>
              <View style={styles.filterOptions}>
                {yearOptions.slice(0, 8).map((year, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.filterOption,
                      filters.year === year && styles.activeFilterOption
                    ]}
                    onPress={() => setFilters({...filters, year: year === 'الكل' ? 'all' : year})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.year === year && styles.activeFilterOptionText
                    ]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Rating Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>التقييم</Text>
              <View style={styles.filterOptions}>
                {ratingOptions.map(rating => (
                  <TouchableOpacity
                    key={rating.id}
                    style={[
                      styles.filterOption,
                      filters.rating === rating.id && styles.activeFilterOption
                    ]}
                    onPress={() => setFilters({...filters, rating: rating.id})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.rating === rating.id && styles.activeFilterOptionText
                    ]}>
                      {rating.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sort Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>ترتيب حسب</Text>
              <View style={styles.filterOptions}>
                {sortOptions.map(sort => (
                  <TouchableOpacity
                    key={sort.id}
                    style={[
                      styles.filterOption,
                      filters.sort_by === sort.id && styles.activeFilterOption
                    ]}
                    onPress={() => setFilters({...filters, sort_by: sort.id as any})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.sort_by === sort.id && styles.activeFilterOptionText
                    ]}>
                      {sort.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => setFilters({
                content_type: 'all',
                genre: 'all',
                year: 'all',
                rating: 'all',
                status: 'all',
                sort_by: 'popularity',
              })}
            >
              <Text style={styles.resetButtonText}>إعادة تعيين</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>تطبيق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!fontsLoaded) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#FFD700" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>القوائم</Text>
        <TouchableOpacity onPress={() => setShowFilters(true)}>
          <Ionicons name="options" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن أنمي..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Summary */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredAnime.length} نتيجة
        </Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="funnel" size={16} color="#FFD700" />
          <Text style={styles.filterButtonText}>فلترة</Text>
        </TouchableOpacity>
      </View>

      {/* Anime List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAnime}
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
              </View>
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>لا توجد نتائج</Text>
              <Text style={styles.emptySubtext}>جرب تغيير معايير البحث أو الفلترة</Text>
            </View>
          )}
        />
      )}

      {/* Filter Modal */}
      {renderFilterModal()}
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    textAlign: 'right',
    marginHorizontal: 10,
    fontFamily: 'Tajawal_400Regular',
  },
  resultsHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  resultsCount: {
    fontSize: 16,
    color: '#ccc',
    fontFamily: 'Tajawal_500Medium',
  },
  filterButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#FFD700',
    marginRight: 5,
    fontFamily: 'Tajawal_400Regular',
  },
  listContent: {
    paddingHorizontal: 10,
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
  genresContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  genreTag: {
    fontSize: 10,
    color: '#FFD700',
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
    marginBottom: 2,
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
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Tajawal_700Bold',
  },
  filterContent: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 25,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'right',
    fontFamily: 'Tajawal_500Medium',
  },
  filterOptions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  activeFilterOption: {
    backgroundColor: '#FFD700',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'Tajawal_400Regular',
  },
  activeFilterOptionText: {
    color: '#000',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row-reverse',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 10,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    color: '#ccc',
    fontFamily: 'Tajawal_500Medium',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    fontFamily: 'Tajawal_500Medium',
  },
});