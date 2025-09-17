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
  Alert
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

export default function Index() {
  const [activeTab, setActiveTab] = useState<'popular' | 'search' | 'seasonal'>('popular');
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [showDetails, setShowDetails] = useState(false);

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

  // Handle tab change
  const handleTabChange = (tab: 'popular' | 'search' | 'seasonal') => {
    setActiveTab(tab);
    if (tab === 'popular') {
      fetchPopularAnime();
    } else if (tab === 'seasonal') {
      fetchSeasonalAnime();
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
        Alert.alert('Error', 'Unable to open the website');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open the website');
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
    <TouchableOpacity
      style={styles.animeCard}
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
      <View style={styles.animeInfo}>
        <Text style={styles.animeTitle} numberOfLines={2}>
          {item.title_english || item.title}
        </Text>
        <View style={styles.animeMetadata}>
          <View style={styles.scoreContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.scoreText}>{item.score?.toFixed(1) || 'N/A'}</Text>
          </View>
          <Text style={styles.episodeText}>
            {item.episodes ? `${item.episodes} eps` : 'Unknown'}
          </Text>
        </View>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
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
                  {selectedAnime.episodes ? `${selectedAnime.episodes} episodes` : 'Unknown episodes'}
                </Text>
              </View>
              
              <Text style={styles.detailsStatus}>{selectedAnime.status}</Text>
              
              {selectedAnime.aired?.string && (
                <Text style={styles.detailsAired}>Aired: {selectedAnime.aired.string}</Text>
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
                  <Text style={styles.synopsisTitle}>Synopsis</Text>
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
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AnimeHub</Text>
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
            Popular
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => handleTabChange('search')}
        >
          <Ionicons name="search" size={20} color={activeTab === 'search' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'seasonal' && styles.activeTab]}
          onPress={() => handleTabChange('seasonal')}
        >
          <Ionicons name="calendar" size={20} color={activeTab === 'seasonal' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'seasonal' && styles.activeTabText]}>
            Seasonal
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search anime..."
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
            <Text style={styles.loadingText}>Loading anime...</Text>
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
                    ? 'No anime found'
                    : 'No anime available'}
                </Text>
              </View>
            }
          />
        )}
      </View>

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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
});