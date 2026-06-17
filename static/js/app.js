document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let state = {
        releases: [],
        filteredReleases: [],
        selectedRelease: null,
        activeFilter: 'all', // 'all', 'Feature', 'Announcement', 'Issue', etc.
        searchQuery: '',
        originalDraft: '' // Holds original generated text for resetting
    };

    // --- DOM Elements ---
    const btnRefresh = document.getElementById('btn-refresh');
    const btnExport = document.getElementById('btn-export');
    const refreshIcon = document.getElementById('refresh-icon');
    const lastUpdatedText = document.getElementById('last-updated-text');
    
    // Stats Cards
    const statAll = document.getElementById('stat-all');
    const statFeatures = document.getElementById('stat-features');
    const statAnnouncements = document.getElementById('stat-announcements');
    const statIssues = document.getElementById('stat-issues');
    
    const countAll = document.getElementById('count-all');
    const countFeatures = document.getElementById('count-features');
    const countAnnouncements = document.getElementById('count-announcements');
    const countIssues = document.getElementById('count-issues');

    // Controls
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterChipsContainer = document.getElementById('filter-chips');

    // Feed Layout
    const resultsCount = document.getElementById('results-count');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const releasesContainer = document.getElementById('releases-container');
    const noResultsState = document.getElementById('no-results-state');
    const btnResetFilters = document.getElementById('btn-reset-filters');

    // Composer
    const composerSidebar = document.getElementById('composer-sidebar');
    const composerEmptyState = document.getElementById('composer-empty-state');
    const composerForm = document.getElementById('composer-form');
    const composerSelectionStatus = document.getElementById('composer-selection-status');
    const previewBadge = document.getElementById('preview-badge');
    const previewDate = document.getElementById('preview-date');
    const previewSourceLink = document.getElementById('preview-source-link');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const btnResetDraft = document.getElementById('btn-reset-draft');
    const xTextPreview = document.getElementById('x-text-preview');
    const xLinkPreviewBox = document.getElementById('x-link-preview-box');
    const btnSendTweet = document.getElementById('btn-send-tweet');
    const charCountText = document.getElementById('char-count-text');
    const charProgress = document.getElementById('char-progress');

    // --- Progress Ring Configuration ---
    const radius = charProgress.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    charProgress.style.strokeDasharray = `${circumference} ${circumference}`;
    charProgress.style.strokeDashoffset = circumference;

    function setProgress(percent) {
        const offset = circumference - (percent / 100) * circumference;
        charProgress.style.strokeDashoffset = offset;
    }

    // --- Helper Functions ---
    function formatTime(dateString) {
        // e.g. "2026-06-17 06:25:04" -> "06:25:04"
        const parts = dateString.split(' ');
        return parts.length > 1 ? parts[1] : dateString;
    }

    // Determine category based on update type
    function getGeneralType(type) {
        const t = type.toLowerCase();
        if (t.includes('feature')) return 'Feature';
        if (t.includes('announcement')) return 'Announcement';
        if (t.includes('issue') || t.includes('fix') || t.includes('resolved') || t.includes('fixed')) return 'Issue';
        return 'Other';
    }

    // Generate Twitter-optimized draft text
    function generateTweetDraft(release) {
        const dateStr = release.date;
        const typeStr = release.type;
        const mainText = release.text;
        const linkUrl = release.link;
        
        // Header prefix: e.g. "BigQuery Release (June 16, 2026): [Feature] "
        const prefix = `BigQuery Release (${dateStr}): [${typeStr}] `;
        // Twitter always counts URL as 23 characters
        const urlCost = 23;
        
        // Max space for main text description:
        // 280 (total limit) - prefix length - urlCost - 2 (spaces & separators)
        const allowedDescLength = 280 - prefix.length - urlCost - 3;
        
        let desc = mainText;
        if (desc.length > allowedDescLength) {
            desc = desc.substring(0, allowedDescLength - 3) + '...';
        }
        
        return `${prefix}${desc}\n\n${linkUrl}`;
    }

    // Calculate length of tweet text, counting URLs correctly (Twitter counts any URL as 23 characters)
    function calculateTweetLength(text) {
        // Find URLs in text
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = text.match(urlRegex);
        
        let length = text.length;
        if (urls) {
            urls.forEach(url => {
                // Subtract literal URL length, add 23 characters
                length = length - url.length + 23;
            });
        }
        return length;
    }

    // --- Core API Functions ---
    async function fetchReleases(force = false) {
        try {
            setLoadingState(true);
            const response = await fetch(`/api/releases${force ? '?refresh=true' : ''}`);
            const data = await response.json();
            
            if (data.success) {
                state.releases = data.releases;
                
                // Update stats counts
                updateStats();
                
                // Apply filters and render
                applyFiltersAndSearch();
                
                // Update header status
                lastUpdatedText.innerText = `Updated at ${data.last_fetched.split(' ')[1] || data.last_fetched}`;
            } else {
                console.error("API error:", data.error);
                alert("Failed to fetch release notes: " + data.error);
            }
        } catch (error) {
            console.error("Network error:", error);
            alert("Network error: Could not fetch release notes.");
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            btnRefresh.classList.add('refreshing');
            refreshIcon.classList.add('fa-spin');
            btnRefresh.disabled = true;
            skeletonLoader.style.display = 'block';
            releasesContainer.style.display = 'none';
            noResultsState.style.display = 'none';
        } else {
            btnRefresh.classList.remove('refreshing');
            refreshIcon.classList.remove('fa-spin');
            btnRefresh.disabled = false;
            skeletonLoader.style.display = 'none';
        }
    }

    // --- Stats & Category Count Calculation ---
    function updateStats() {
        const allCount = state.releases.length;
        
        let featureCount = 0;
        let announcementCount = 0;
        let issueCount = 0;
        
        state.releases.forEach(rel => {
            const cat = getGeneralType(rel.type);
            if (cat === 'Feature') featureCount++;
            else if (cat === 'Announcement') announcementCount++;
            else if (cat === 'Issue') issueCount++;
        });
        
        countAll.innerText = allCount;
        countFeatures.innerText = featureCount;
        countAnnouncements.innerText = announcementCount;
        countIssues.innerText = issueCount;
    }

    // --- Filtering and Searching ---
    function applyFiltersAndSearch() {
        const query = state.searchQuery.toLowerCase().trim();
        const activeFilter = state.activeFilter;
        
        state.filteredReleases = state.releases.filter(release => {
            // 1. Filter match
            let matchesFilter = true;
            if (activeFilter !== 'all') {
                if (['Feature', 'Announcement', 'Issue'].includes(activeFilter)) {
                    matchesFilter = getGeneralType(release.type) === activeFilter;
                } else {
                    matchesFilter = release.type.toLowerCase() === activeFilter.toLowerCase();
                }
            }
            
            // 2. Search match
            let matchesSearch = true;
            if (query !== '') {
                matchesSearch = 
                    release.date.toLowerCase().includes(query) ||
                    release.type.toLowerCase().includes(query) ||
                    release.text.toLowerCase().includes(query) ||
                    release.html.toLowerCase().includes(query);
            }
            
            return matchesFilter && matchesSearch;
        });
        
        resultsCount.innerText = `Showing ${state.filteredReleases.length} of ${state.releases.length} updates`;
        renderFeed();
    }

    // --- DOM Rendering Functions ---
    function renderFeed() {
        releasesContainer.innerHTML = '';
        
        if (state.filteredReleases.length === 0) {
            releasesContainer.style.display = 'none';
            noResultsState.style.display = 'flex';
            return;
        }
        
        noResultsState.style.display = 'none';
        releasesContainer.style.display = 'flex';
        
        state.filteredReleases.forEach(release => {
            const isSelected = state.selectedRelease && state.selectedRelease.id === release.id;
            const card = document.createElement('article');
            card.className = `release-card ${isSelected ? 'selected' : ''}`;
            card.dataset.id = release.id;
            
            // Map badge classes
            const badgeClass = release.type.toLowerCase().replace(/\s+/g, '-');
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="badge ${badgeClass}">${release.type}</span>
                        <span class="card-date"><i class="fa-regular fa-calendar-days"></i> ${release.date}</span>
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn copy-btn" title="Copy plain text description to clipboard">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <button class="card-select-btn" title="Select this update to draft a Tweet">
                            <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${release.html}
                </div>
            `;
            
            // Bind Copy Button Handler
            const copyBtn = card.querySelector('.copy-btn');
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid selecting the card
                navigator.clipboard.writeText(release.text).then(() => {
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
                    }, 1500);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            });
            
            // Add click listener for selecting card
            card.addEventListener('click', (e) => {
                // If user clicks a link inside the card, allow default behavior (opening link) 
                // ONLY if they meant to click the link, but let's prevent default click selections
                if (e.target.tagName === 'A') {
                    // Let links function, but select card as well
                    window.open(e.target.href, '_blank');
                    e.stopPropagation();
                    return;
                }
                selectRelease(release);
            });
            
            releasesContainer.appendChild(card);
        });
    }

    function selectRelease(release) {
        state.selectedRelease = release;
        
        // Visual selection update in DOM
        document.querySelectorAll('.release-card').forEach(card => {
            if (card.dataset.id === release.id) {
                card.classList.add('selected');
                card.querySelector('.card-select-btn i').className = 'fa-solid fa-check';
            } else {
                card.classList.remove('selected');
                card.querySelector('.card-select-btn i').className = 'fa-solid fa-plus';
            }
        });
        
        // Show Sidebar / Update composer states
        composerSidebar.classList.add('selected');
        composerSelectionStatus.innerText = "Selected";
        composerSelectionStatus.style.color = "var(--accent-blue)";
        composerEmptyState.style.display = 'none';
        composerForm.style.display = 'block';
        
        // Set Preview headers
        previewBadge.innerText = release.type;
        previewBadge.className = `badge ${release.type.toLowerCase().replace(/\s+/g, '-')}`;
        previewDate.innerText = release.date;
        previewSourceLink.href = release.link || '#';
        
        // Generate draft
        const draft = generateTweetDraft(release);
        state.originalDraft = draft;
        tweetTextarea.value = draft;
        
        // Update character counts and mock views
        handleTweetInputChange();
    }

    function handleTweetInputChange() {
        const text = tweetTextarea.value;
        
        // Calculate length based on Twitter standards (23 chars for URLs)
        const tweetLength = calculateTweetLength(text);
        const charsRemaining = 280 - tweetLength;
        
        charCountText.innerText = charsRemaining;
        
        // Progress Circle calculation
        const percent = Math.min((tweetLength / 280) * 100, 100);
        setProgress(percent);
        
        // Add color indicators to character counter and progress bar
        charCountText.className = 'char-count';
        if (charsRemaining < 0) {
            charCountText.classList.add('danger');
            charProgress.style.stroke = 'var(--accent-rose)';
            btnSendTweet.disabled = true;
        } else if (charsRemaining <= 20) {
            charCountText.classList.add('warning');
            charProgress.style.stroke = 'var(--accent-amber)';
            btnSendTweet.disabled = false;
        } else {
            charProgress.style.stroke = 'var(--accent-blue)';
            btnSendTweet.disabled = false;
        }
        
        if (text.trim() === '') {
            btnSendTweet.disabled = true;
        }
        
        // Render Live Preview text
        renderLivePreview(text);
    }

    function renderLivePreview(text) {
        // Strip out the link URL for cleaner mock preview box, or render it inside the preview box
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = text.match(urlRegex);
        
        let cleanedText = text;
        let previewLink = '';
        
        if (urls && urls.length > 0) {
            // We use the first link for the link card preview
            previewLink = urls[0];
            // Remove the URL from the text block in the preview, replacing with a blue hyperlink representation
            cleanedText = text.replace(previewLink, '').trim();
        }
        
        // Build preview text with simple link tag highlighted in cyan
        xTextPreview.innerText = cleanedText;
        if (previewLink) {
            const linkSpan = document.createElement('span');
            linkSpan.className = 'x-hyperlink';
            linkSpan.style.color = '#1d9bf0'; // X link color
            linkSpan.innerText = ` ${previewLink.substring(0, 30)}...`;
            xTextPreview.appendChild(linkSpan);
            
            // Show link preview card block
            xLinkPreviewBox.style.display = 'flex';
        } else {
            xLinkPreviewBox.style.display = 'none';
        }
    }

    // --- Interactive Event Listeners ---
    
    // Refresh Button Click
    btnRefresh.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Export to CSV Click
    btnExport.addEventListener('click', () => {
        exportToCSV();
    });

    function exportToCSV() {
        if (state.filteredReleases.length === 0) {
            alert("No release notes available to export.");
            return;
        }

        let csvContent = "";
        // CSV Header
        csvContent += '"Date","Type","Description","Documentation Link"\r\n';

        // Add rows
        state.filteredReleases.forEach(rel => {
            // Escape double quotes by doubling them
            const dateVal = rel.date.replace(/"/g, '""');
            const typeVal = rel.type.replace(/"/g, '""');
            const textVal = rel.text.replace(/"/g, '""');
            const linkVal = rel.link.replace(/"/g, '""');

            csvContent += `"${dateVal}","${typeVal}","${textVal}","${linkVal}"\r\n`;
        });

        // Use a blob for encoding support and handling large amounts of data
        const csvData = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(csvData);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        
        // Generate nice filename: bigquery_releases_YYYY-MM-DD.csv
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `bigquery_releases_${today}.csv`);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Stat Cards Filter Click
    const statsCards = [
        { elem: statAll, filter: 'all' },
        { elem: statFeatures, filter: 'Feature' },
        { elem: statAnnouncements, filter: 'Announcement' },
        { elem: statIssues, filter: 'Issue' }
    ];

    statsCards.forEach(item => {
        item.elem.addEventListener('click', () => {
            // Remove active from all stat cards
            statsCards.forEach(c => c.elem.classList.remove('active'));
            // Remove active from filter chips
            document.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
            
            // Add active to this stat card
            item.elem.classList.add('active');
            
            // Set active chip match in the controls row
            const matchingChip = document.querySelector(`.chip[data-type="${item.filter}"]`);
            if (matchingChip) matchingChip.classList.add('active');
            
            state.activeFilter = item.filter;
            applyFiltersAndSearch();
        });
    });

    // Filter Chips Click
    filterChipsContainer.addEventListener('click', (e) => {
        const clickedChip = e.target.closest('.chip');
        if (!clickedChip) return;
        
        // Toggle active states
        document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
        clickedChip.classList.add('active');
        
        // Update stats active state
        statsCards.forEach(c => c.elem.classList.remove('active'));
        const filterVal = clickedChip.dataset.type;
        const matchingStatCard = document.querySelector(`.stat-card[data-filter="${filterVal}"]`);
        if (matchingStatCard) matchingStatCard.classList.add('active');
        else if (filterVal === 'all') statAll.classList.add('active');
        
        state.activeFilter = filterVal;
        applyFiltersAndSearch();
    });

    // Search Input Logic
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        state.searchQuery = value;
        
        if (value.trim() !== '') {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        
        applyFiltersAndSearch();
    });

    // Clear Search Click
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });

    // Reset Filters Button
    btnResetFilters.addEventListener('click', resetFilters);
    
    function resetFilters() {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        
        // Reset chips to 'All'
        document.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
        document.querySelector('.chip[data-type="all"]').classList.add('active');
        
        // Reset stats active
        statsCards.forEach(c => c.elem.classList.remove('active'));
        statAll.classList.add('active');
        
        state.activeFilter = 'all';
        applyFiltersAndSearch();
    }

    // Composer Input change
    tweetTextarea.addEventListener('input', handleTweetInputChange);

    // Reset Composer Draft
    btnResetDraft.addEventListener('click', () => {
        if (state.selectedRelease) {
            tweetTextarea.value = state.originalDraft;
            handleTweetInputChange();
        }
    });

    // Send Tweet to X
    btnSendTweet.addEventListener('click', () => {
        const text = tweetTextarea.value.trim();
        if (text === '') return;
        
        // Double-check length before sending
        if (calculateTweetLength(text) > 280) {
            alert("Tweet exceeds the 280-character limit! Please shorten your text before posting.");
            return;
        }
        
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank');
    });

    // --- Init ---
    fetchReleases();
});
