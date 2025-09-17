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

const { width: screenWidth } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface AnimeImage {
  jpg: {
    image_url: string;
    small_image_url: string;
    large_image_url: string;
  };
  webp: {
    image_url: string;
    small_image_url: string;
    large_image_url: string;
  };
}

interface Anime {
  mal_id: number;
  title: string;
  title_english?: string;
  images: {
    jpg: AnimeImage['jpg'];
    webp: AnimeImage['webp'];
  };
  score?: number;
  episodes?: number;
  status?: string;
  synopsis?: string;
  genres?: Array<{ name: string }>;
  aired?: {
    string: string;
  };
}

interface AnimeResponse {
  data: Anime[];
  pagination: {
    current_page: number;
    has_next_page: boolean;
    last_visible_page: number;
  };
}

interface Genre {
  mal_id: number;
  name: string;
}

interface FilterState {
  genres: number[];
  year: string;
  status: string;
  type: string;
  rating: string;
  order_by: string;
  sort: string;
}

export default function Index() {
  const [activeTab, setActiveTab] = useState<'popular' | 'search' | 'seasonal' | 'filter'>('popular');
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filteredResults, setFilteredResults] = useState<Anime[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [showFilterResults, setShowFilterResults] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    year: '',
    status: '',
    type: '',
    rating: '',
    order_by: 'score',
    sort: 'desc'
  });

  // Enable RTL for Arabic
  useEffect(() => {
    I18nManager.forceRTL(true);
  }, []);

  // Fetch popular anime
  const fetchPopularAnime = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/top?limit=20`);
      const data: AnimeResponse = await response.json();
      setAnimeList(data.data || []);
    } catch (error) {
      console.error('Error fetching popular anime:', error);
    } finally {
      setLoading(false);
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
      const response = await fetch(`${BACKEND_URL}/api/anime/search?q=${encodeURIComponent(query)}&limit=20`);
      const data: AnimeResponse = await response.json();
      setSearchResults(data.data || []);
    } catch (error) {
      console.error('Error searching anime:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch current season anime
  const fetchSeasonalAnime = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/anime/current-season?limit=20`);
      const data: AnimeResponse = await response.json();
      setAnimeList(data.data || []);
    } catch (error) {
      console.error('Error fetching seasonal anime:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch genres
  const fetchGenres = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/genres`);
      const data = await response.json();
      setGenres(data.data || []);
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  // Apply filters
  const applyFilters = async () => {
    try {
      setFilterLoading(true);
      const params = new URLSearchParams();
      
      if (filters.genres.length > 0) {
        params.append('genres', filters.genres.join(','));
      }
      if (filters.year) {
        params.append('start_date', `${filters.year}-01-01`);
        params.append('end_date', `${filters.year}-12-31`);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.type) {
        params.append('type', filters.type);
      }
      if (filters.rating) {
        params.append('rating', filters.rating);
      }
      if (filters.order_by) {
        params.append('order_by', filters.order_by);
      }
      if (filters.sort) {
        params.append('sort', filters.sort);
      }
      
      params.append('limit', '20');
      
      const response = await fetch(`${BACKEND_URL}/api/anime/search?${params.toString()}`);
      const data: AnimeResponse = await response.json();
      setFilteredResults(data.data || []);
      
      // Show results page
      setShowFilterResults(true);
    } catch (error) {
      console.error('Error applying filters:', error);
      setFilteredResults([]);
      Alert.alert('خطأ', 'حدث خطأ أثناء تطبيق الفلاتر');
    } finally {
      setFilterLoading(false);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      genres: [],
      year: '',
      status: '',
      type: '',
      rating: '',
      order_by: 'score',
      sort: 'desc'
    });
    setFilteredResults([]);
  };

  // Handle tab change
  const handleTabChange = (tab: 'popular' | 'search' | 'seasonal' | 'filter') => {
    setActiveTab(tab);
    if (tab === 'popular') {
      fetchPopularAnime();
    } else if (tab === 'seasonal') {
      fetchSeasonalAnime();
    } else if (tab === 'filter' && genres.length === 0) {
      fetchGenres();
    }
  };

  // Handle search input
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (activeTab === 'search') {
        searchAnime(searchQuery);
      }
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, activeTab]);

  // Initial load
  useEffect(() => {
    fetchPopularAnime();
  }, []);

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

  // Refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'popular') {
      fetchPopularAnime();
    } else if (activeTab === 'seasonal') {
      fetchSeasonalAnime();
    }
    setRefreshing(false);
  };

  // Render anime card
  const renderAnimeCard = ({ item }: { item: Anime }) => (
    <View style={styles.animeCard}>
      <TouchableOpacity
        onPress={() => {
          setSelectedAnime(item);
          setShowDetails(true);
        }}
      >
        <Image
          source={{ uri: item.images.jpg.large_image_url }}
          style={styles.animeImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
      
      <View style={styles.animeInfo}>
        <Text style={styles.animeTitle} numberOfLines={2}>
          {item.title_english || item.title}
        </Text>
        <View style={styles.animeMetadata}>
          <View style={styles.scoreContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.scoreText}>{item.score?.toFixed(1) || 'غير متاح'}</Text>
          </View>
          <Text style={styles.episodeText}>
            {item.episodes ? `${item.episodes} حلقة` : 'غير معروف'}
          </Text>
        </View>
        <Text style={styles.statusText}>{item.status}</Text>
        
        {/* Watch Button Inside Card */}
        <TouchableOpacity
          style={styles.watchButton}
          onPress={handleWatchAnime}
          activeOpacity={0.8}
        >
          <Ionicons name="play-circle" size={16} color="#fff" />
          <Text style={styles.watchButtonText}>شاهد الآن</Text>
        </TouchableOpacity>
      </View>
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
              source={{ uri: selectedAnime.images.jpg.large_image_url }}
              style={styles.detailsImage}
              resizeMode="cover"
            />
            
            <View style={styles.detailsContent}>
              <Text style={styles.detailsTitle}>
                {selectedAnime.title_english || selectedAnime.title}
              </Text>
              
              <View style={styles.detailsMetadata}>
                <View style={styles.detailsScoreContainer}>
                  <Ionicons name="star" size={18} color="#FFD700" />
                  <Text style={styles.detailsScoreText}>
                    {selectedAnime.score?.toFixed(1) || 'N/A'}
                  </Text>
                </View>
                <Text style={styles.detailsEpisodeText}>
                  {selectedAnime.episodes ? `${selectedAnime.episodes} حلقة` : 'حلقات غير معروفة'}
                </Text>
              </View>
              
              <Text style={styles.detailsStatus}>{selectedAnime.status}</Text>
              
              {selectedAnime.aired?.string && (
                <Text style={styles.detailsAired}>تاريخ العرض: {selectedAnime.aired.string}</Text>
              )}
              
              {selectedAnime.genres && selectedAnime.genres.length > 0 && (
                <View style={styles.genresContainer}>
                  {selectedAnime.genres.map((genre, index) => (
                    <View key={index} style={styles.genreTag}>
                      <Text style={styles.genreText}>{genre.name}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {selectedAnime.synopsis && (
                <View style={styles.synopsisContainer}>
                  <Text style={styles.synopsisTitle}>القصة</Text>
                  <Text style={styles.synopsisText}>{selectedAnime.synopsis}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Show Filter Results Page */}
      {showFilterResults ? (
        <View style={styles.filterResultsContainer}>
          {/* Filter Results Header */}
          <View style={styles.filterResultsHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowFilterResults(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
              <Text style={styles.backButtonText}>رجوع للفلاتر</Text>
            </TouchableOpacity>
            <Text style={styles.filterResultsTitle}>
              نتائج البحث ({filteredResults.length})
            </Text>
          </View>

          {/* Filter Results Content */}
          <View style={styles.content}>
            {filterLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff6b6b" />
                <Text style={styles.loadingText}>جاري البحث...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredResults}
                renderItem={renderAnimeCard}
                keyExtractor={(item) => item.mal_id.toString()}
                numColumns={2}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={64} color="#666" />
                    <Text style={styles.emptyText}>لا توجد نتائج للفلاتر المحددة</Text>
                    <TouchableOpacity
                      style={styles.modifyFiltersButton}
                      onPress={() => setShowFilterResults(false)}
                    >
                      <Text style={styles.modifyFiltersButtonText}>تعديل الفلاتر</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            )}
          </View>
        </View>
      ) : (
        /* Main App Interface */
        <>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>cimaroom</Text>
            <Ionicons name="heart" size={24} color="#ff6b6b" />
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'popular' && styles.activeTab]}
              onPress={() => handleTabChange('popular')}
            >
              <Ionicons name="flame" size={20} color={activeTab === 'popular' ? '#fff' : '#666'} />
              <Text style={[styles.tabText, activeTab === 'popular' && styles.activeTabText]}>
                الأكثر شعبية
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'search' && styles.activeTab]}
              onPress={() => handleTabChange('search')}
            >
              <Ionicons name="search" size={20} color={activeTab === 'search' ? '#fff' : '#666'} />
              <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
                البحث
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'filter' && styles.activeTab]}
              onPress={() => handleTabChange('filter')}
            >
              <Ionicons name="options" size={20} color={activeTab === 'filter' ? '#fff' : '#666'} />
              <Text style={[styles.tabText, activeTab === 'filter' && styles.activeTabText]}>
                الفلاتر
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'seasonal' && styles.activeTab]}
              onPress={() => handleTabChange('seasonal')}
            >
              <Ionicons name="calendar" size={20} color={activeTab === 'seasonal' ? '#fff' : '#666'} />
              <Text style={[styles.tabText, activeTab === 'seasonal' && styles.activeTabText]}>
                الموسمية
              </Text>
            </TouchableOpacity>
          </View>

      {/* Filter Section */}
      {activeTab === 'filter' && (
        <ScrollView style={styles.filterContainer} showsVerticalScrollIndicator={false}>
          {/* Year Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>السنة</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="مثال: 2024"
              placeholderTextColor="#666"
              value={filters.year}
              onChangeText={(text) => setFilters({...filters, year: text})}
              keyboardType="numeric"
            />
          </View>

          {/* Status Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>حالة الأنيمي</Text>
            <View style={styles.filterOptions}>
              {[
                { key: '', label: 'الكل' },
                { key: 'airing', label: 'يعرض حالياً' },
                { key: 'complete', label: 'مكتمل' },
                { key: 'upcoming', label: 'قادم' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterOption,
                    filters.status === option.key && styles.activeFilterOption
                  ]}
                  onPress={() => setFilters({...filters, status: option.key})}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.status === option.key && styles.activeFilterOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Type Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>نوع الأنيمي</Text>
            <View style={styles.filterOptions}>
              {[
                { key: '', label: 'الكل' },
                { key: 'tv', label: 'مسلسل' },
                { key: 'movie', label: 'فيلم' },
                { key: 'ova', label: 'OVA' },
                { key: 'ona', label: 'ONA' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterOption,
                    filters.type === option.key && styles.activeFilterOption
                  ]}
                  onPress={() => setFilters({...filters, type: option.key})}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.type === option.key && styles.activeFilterOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rating Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>التصنيف العمري</Text>
            <View style={styles.filterOptions}>
              {[
                { key: '', label: 'الكل' },
                { key: 'g', label: 'عام' },
                { key: 'pg', label: 'إرشاد أبوي' },
                { key: 'pg13', label: '+13' },
                { key: 'r17', label: '+17' },
                { key: 'r', label: '+18' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterOption,
                    filters.rating === option.key && styles.activeFilterOption
                  ]}
                  onPress={() => setFilters({...filters, rating: option.key})}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.rating === option.key && styles.activeFilterOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Genres Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>الأنواع</Text>
            <View style={styles.genresContainer}>
              {genres.map((genre) => (
                <TouchableOpacity
                  key={genre.mal_id}
                  style={[
                    styles.genreChip,
                    filters.genres.includes(genre.mal_id) && styles.activeGenreChip
                  ]}
                  onPress={() => {
                    const newGenres = filters.genres.includes(genre.mal_id)
                      ? filters.genres.filter(id => id !== genre.mal_id)
                      : [...filters.genres, genre.mal_id];
                    setFilters({...filters, genres: newGenres});
                  }}
                >
                  <Text style={[
                    styles.genreChipText,
                    filters.genres.includes(genre.mal_id) && styles.activeGenreChipText
                  ]}>
                    {genre.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort Options */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>ترتيب النتائج</Text>
            <View style={styles.filterOptions}>
              {[
                { key: 'score', label: 'التقييم' },
                { key: 'popularity', label: 'الشعبية' },
                { key: 'start_date', label: 'تاريخ البدء' },
                { key: 'episodes', label: 'عدد الحلقات' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterOption,
                    filters.order_by === option.key && styles.activeFilterOption
                  ]}
                  onPress={() => setFilters({...filters, order_by: option.key})}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.order_by === option.key && styles.activeFilterOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetFilters}
            >
              <Ionicons name="refresh" size={20} color="#666" />
              <Text style={styles.resetButtonText}>إعادة تعيين</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={applyFilters}
              disabled={filterLoading}
            >
              {filterLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="search" size={20} color="#fff" />
              )}
              <Text style={styles.applyButtonText}>
                {filterLoading ? 'جاري البحث...' : 'تطبيق الفلاتر'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Search Input */}
      {activeTab === 'search' && (
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
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff6b6b" />
            <Text style={styles.loadingText}>جارٍ تحميل الأنيمي...</Text>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'search' ? searchResults : animeList}
            renderItem={renderAnimeCard}
            keyExtractor={(item) => item.mal_id.toString()}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#ff6b6b']}
                tintColor="#ff6b6b"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="film-outline" size={64} color="#666" />
                <Text style={styles.emptyText}>
                  {activeTab === 'search' && searchQuery
                    ? 'لم يتم العثور على أنيمي'
                    : 'لا توجد أنيمي متاحة'}
                </Text>
              </View>
            }
          />
        )}
      </View>
        </>
      )}

      {/* Details Modal */}
      {showDetails && renderAnimeDetails()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#111',
  },
  headerSpacer: {
    width: 24, // Same width as the heart icon to center the title
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111',
    marginHorizontal: 20,
    borderRadius: 25,
    padding: 4,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#ff6b6b',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 15,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#fff',
  },
  content: {
    flex: 1,
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
  },
  listContainer: {
    padding: 20,
  },
  animeCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 15,
    margin: 5,
    overflow: 'hidden',
  },
  animeImage: {
    width: '100%',
    height: 180,
  },
  animeInfo: {
    padding: 12,
  },
  animeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  animeMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  episodeText: {
    fontSize: 12,
    color: '#999',
  },
  statusText: {
    fontSize: 11,
    color: '#ff6b6b',
    fontWeight: '500',
  },
  watchButton: {
    backgroundColor: '#ff6b6b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
    width: screenWidth * 0.9,
    maxHeight: '90%',
    backgroundColor: '#111',
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
    height: 300,
  },
  detailsContent: {
    padding: 20,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
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
  },
  detailsEpisodeText: {
    fontSize: 14,
    color: '#999',
  },
  detailsStatus: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '500',
    marginBottom: 8,
  },
  detailsAired: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  genreTag: {
    backgroundColor: '#333',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 3,
  },
  genreText: {
    fontSize: 12,
    color: '#fff',
  },
  synopsisContainer: {
    marginTop: 10,
  },
  synopsisTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  synopsisText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  filterContainer: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  filterInput: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  activeFilterOption: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  filterOptionText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterOptionText: {
    color: '#fff',
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  activeGenreChip: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  genreChipText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  activeGenreChipText: {
    color: '#fff',
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  applyButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6b6b',
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  filterResultsContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  filterResultsHeader: {
    backgroundColor: '#111',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterResultsTitle: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modifyFiltersButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 15,
  },
  modifyFiltersButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});