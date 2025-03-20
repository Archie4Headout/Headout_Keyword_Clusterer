document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeButton(newTheme);
    });

    function updateThemeButton(theme) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    const csvFile = document.getElementById('csvFile');
    const clusterButton = document.getElementById('clusterButton');
    const stopButton = document.getElementById('stopButton');
    const downloadButton = document.getElementById('downloadButton');
    const downloadTSVButton = document.getElementById('downloadTSVButton');
    const clusterResults = document.getElementById('clusterResults');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = uploadProgress.querySelector('.progress-bar');
    const totalKeywordsElement = document.getElementById('totalKeywords');
    const totalClustersElement = document.getElementById('totalClusters');
    const processingStatusElement = document.getElementById('processingStatus');
    const progressInfoElement = document.getElementById('progressInfo');
    const elapsedTimeElement = document.getElementById('elapsedTime');
    const etaTimeElement = document.getElementById('etaTime');
    const suggestedClusters = document.getElementById('suggestedClusters');
    const clusterError = document.getElementById('clusterError');

    let keywords = [];
    let currentClusters = [];
    const BATCH_SIZE = 200; // Number of keywords to process in each batch
    const API_URL = 'https://api.openai.com/v1/chat/completions';

    // Function to get API key from environment
    async function getApiKey() {
        try {
            const response = await fetch('/.env');
            const text = await response.text();
            const match = text.match(/OPENAI_API_KEY=(.+)/);
            if (match && match[1]) {
                return match[1].trim();
            }
            throw new Error('API key not found in .env file');
        } catch (error) {
            logError('Failed to load API key from .env file. Please ensure the file exists and contains a valid API key.', error);
            return null;
        }
    }

    let startTime = null;
    let timerInterval = null;
    let isProcessing = false;
    let currentBatchIndex = 0;
    let totalBatches = 0;

    // Add error logging
    let errorLog = [];
    const errorLogElement = document.createElement('div');
    errorLogElement.id = 'errorLog';
    errorLogElement.className = 'error-log minimized'; // Start minimized
    
    // Add minimize/maximize button
    const errorLogHeader = document.createElement('div');
    errorLogHeader.className = 'error-log-header';
    const errorLogTitle = document.createElement('span');
    errorLogTitle.textContent = 'Error Log';
    const toggleButton = document.createElement('button');
    toggleButton.className = 'error-log-toggle';
    toggleButton.innerHTML = '▼';
    
    // Make both header and button toggle the log
    const toggleErrorLog = () => {
        errorLogElement.classList.toggle('minimized');
        toggleButton.innerHTML = errorLogElement.classList.contains('minimized') ? '▼' : '▲';
    };
    
    errorLogHeader.onclick = toggleErrorLog;
    toggleButton.onclick = (e) => {
        e.stopPropagation(); // Prevent double-toggle when clicking button
        toggleErrorLog();
    };
    
    errorLogHeader.appendChild(errorLogTitle);
    errorLogHeader.appendChild(toggleButton);
    errorLogElement.appendChild(errorLogHeader);
    
    // Create container for error messages
    const errorLogContent = document.createElement('div');
    errorLogContent.className = 'error-log-content';
    errorLogElement.appendChild(errorLogContent);
    
    document.body.appendChild(errorLogElement);

    function logError(message, error = null) {
        const timestamp = new Date().toLocaleTimeString();
        const errorEntry = {
            timestamp,
            message,
            error: error ? error.toString() : null,
            stack: error ? error.stack : null
        };
        errorLog.push(errorEntry);
        
        // Update error log display
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.innerHTML = `
            <span class="error-timestamp">${timestamp}</span>
            <span class="error-text">${message}</span>
            ${error ? `<pre class="error-details">${error.stack || error.toString()}</pre>` : ''}
        `;
        errorLogContent.appendChild(errorMessage);
        errorLogContent.scrollTop = errorLogContent.scrollHeight;
        
        // Show the error log if it's the first error
        if (errorLog.length === 1) {
            errorLogElement.classList.remove('minimized');
            toggleButton.innerHTML = '▲';
        }
    }

    function downloadErrorLog() {
        const logContent = errorLog.map(entry => 
            `[${entry.timestamp}] ${entry.message}\n${entry.error ? `Error: ${entry.error}\n${entry.stack || ''}\n` : ''}`
        ).join('\n');

        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `error_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Add error log download button
    const errorLogButton = document.createElement('button');
    errorLogButton.id = 'errorLogButton';
    errorLogButton.className = 'btn btn-secondary';
    errorLogButton.textContent = 'Download Error Log';
    errorLogButton.onclick = downloadErrorLog;
    document.querySelector('.container').appendChild(errorLogButton);

    function startTimer() {
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        elapsedTimeElement.textContent = `Elapsed: ${formatTime(elapsed)}`;
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${remainingSeconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    }

    function updateETA(currentBatch, totalBatches, elapsedSeconds) {
        if (currentBatch === 0) return;
        
        const avgTimePerBatch = elapsedSeconds / currentBatch;
        const remainingBatches = totalBatches - currentBatch;
        const etaSeconds = Math.floor(avgTimePerBatch * remainingBatches);
        
        etaTimeElement.textContent = `ETA: ${formatTime(etaSeconds)}`;
    }

    function resetUI() {
        clusterButton.disabled = false;
        stopButton.classList.add('d-none');
        downloadButton.classList.add('d-none');
        downloadTSVButton.classList.add('d-none');
        uploadProgress.classList.add('d-none');
        progressBar.style.width = '0%';
        progressInfoElement.textContent = '0/0 chunks';
        elapsedTimeElement.textContent = 'Elapsed: 0s';
        etaTimeElement.textContent = 'ETA: --';
        processingStatusElement.textContent = 'Ready';
        processingStatusElement.classList.remove('processing');
        stopTimer();
        isProcessing = false;
        currentBatchIndex = 0;
        totalBatches = 0;
        copyCSVButton.classList.add('d-none');
        copyTSVButton.classList.add('d-none');
    }

    function downloadResults(format = 'csv') {
        if (!currentClusters.length) return;

        // Create content with headers
        const headers = 'Cluster Type,Cluster Name,Cluster Volume,Keyword,Keyword Volume';
        let content = headers + '\n';
        
        // Group clusters by type
        const paidClusters = currentClusters.filter(c => c.type === 'paid');
        const organicClusters = currentClusters.filter(c => c.type === 'organic');

        // Process paid clusters
        paidClusters.forEach(cluster => {
            const clusterVolume = calculateClusterVolume(cluster.keywords);
            cluster.keywords.forEach((keyword, index) => {
                const keywordData = keywords.find(k => k.keyword === keyword);
                const keywordVolume = keywordData?.volume || '';
                // Only include cluster name and volume in first row of each cluster
                const clusterName = index === 0 ? cluster.name : '';
                const clusterVolumeDisplay = index === 0 ? clusterVolume : '';
                content += `Paid,${clusterName},${clusterVolumeDisplay},${keyword},${keywordVolume}\n`;
            });
        });

        // Process organic clusters
        organicClusters.forEach(cluster => {
            const clusterVolume = calculateClusterVolume(cluster.keywords);
            cluster.keywords.forEach((keyword, index) => {
                const keywordData = keywords.find(k => k.keyword === keyword);
                const keywordVolume = keywordData?.volume || '';
                // Only include cluster name and volume in first row of each cluster
                const clusterName = index === 0 ? cluster.name : '';
                const clusterVolumeDisplay = index === 0 ? clusterVolume : '';
                content += `Organic,${clusterName},${clusterVolumeDisplay},${keyword},${keywordVolume}\n`;
            });
        });

        // Convert to TSV if needed
        if (format === 'tsv') {
            content = content.split('\n').map(line => 
                line.split(',').map(cell => 
                    cell.includes(',') ? `"${cell}"` : cell
                ).join('\t')
            ).join('\n');
        }

        // Create and trigger download
        const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'text/tab-separated-values;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `keyword_clusters.${format}`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    stopButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to stop the clustering process?')) {
            isProcessing = false;
            resetUI();
            location.reload(); // Reload the page to reset everything
        }
    });

    downloadButton.addEventListener('click', () => downloadResults('csv'));
    downloadTSVButton.addEventListener('click', () => downloadResults('tsv'));

    function createPrompt(batch, suggestedClustersList = null) {
        const basePrompt = `You are an LLM responsible for clustering up to 2,000+ keywords from a CSV file. Your task is to create precise, specific clusters based on exact themes within the dataset.

Step 1: Clustering Principles
    1. Create granular, specific clusters instead of broad categories
    2. Each cluster should represent a distinct theme or specific attraction
    3. Avoid overly broad categories like "Tours" or "Tickets"
    4. Use the exact location/attraction name in cluster titles
    5. Distinguish between paid and organic intent

Step 2: Cluster Types and Examples

A. Paid Intent Clusters (Transactional):
    • Specific attraction + transaction type:
      - "Statue of Liberty Tickets"
      - "Ellis Island Ferry Pass"
      - "Liberty Island Cruise Tickets"
    • Specific tour packages:
      - "Statue of Liberty Guided Tour"
      - "Ellis Island Audio Tour"
      - "Liberty Island Skip-the-Line Tour"

B. Organic Intent Clusters (Informational):
    • Specific attraction + information type:
      - "Statue of Liberty History"
      - "Ellis Island Visitor Guide"
      - "Liberty Island Facts"
    • Specific attraction + experience:
      - "Statue of Liberty Viewing Tips"
      - "Ellis Island Museum Guide"
      - "Liberty Island Photo Spots"

Step 3: Clustering Rules
    • Create specific clusters based on exact themes in the data
    • Each keyword belongs to only one cluster
    • Use only provided keywords (no new ones)
    • Account for spelling variations
    • Include location/attraction names in cluster titles
    • Separate paid and organic intent into different clusters
    • Avoid generic categories unless no specific theme exists`;

        const suggestedClustersSection = suggestedClustersList ? `
Step 4: Suggested Clusters
    • Use the following suggested clusters if they are relevant to the keywords:
${suggestedClustersList.map(cluster => `      - "${cluster.name}" (${cluster.type})`).join('\n')}
    • Only use suggested clusters that are relevant to the keywords
    • Create additional clusters if needed for unclustered keywords
    • Maintain the same cluster type (paid/organic) as suggested` : '';

        return `${basePrompt}${suggestedClustersSection}

Keywords to analyze:
${batch.map(k => k.keyword).join('\n')}

Please provide the clusters in the following JSON format:
{
    "clusters": [
        {
            "name": "Specific Cluster Name",
            "keywords": ["keyword1", "keyword2", ...],
            "type": "paid" or "organic"
        }
    ]
}`;
    }

    function parseSuggestedClusters(clusterText) {
        if (!clusterText.trim()) return null;
        
        try {
            return clusterText.split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .map(line => {
                    const [name, type] = line.split('|').map(item => item.trim());
                    if (!name || !type || !['paid', 'organic'].includes(type.toLowerCase())) {
                        throw new Error('Invalid cluster format');
                    }
                    return {
                        name,
                        type: type.toLowerCase()
                    };
                });
        } catch (error) {
            logError('Error parsing suggested clusters', error);
            return null;
        }
    }

    function validateSuggestedClusters(suggestedClusters, keywords) {
        if (!suggestedClusters) return true;
        
        // Create a set of all keywords for quick lookup
        const keywordSet = new Set(keywords.map(k => k.keyword.toLowerCase()));
        
        // Check if any suggested cluster name contains words from the keywords
        const hasRelevantClusters = suggestedClusters.some(cluster => {
            const clusterWords = cluster.name.toLowerCase().split(/\s+/);
            return clusterWords.some(word => 
                keywordSet.has(word) || 
                Array.from(keywordSet).some(k => k.includes(word) || word.includes(k))
            );
        });

        return hasRelevantClusters;
    }

    clusterButton.addEventListener('click', async () => {
        if (!csvFile.files.length) {
            logError('No CSV file selected');
            alert('Please select a CSV file first');
            return;
        }

        try {
            isProcessing = true;
            clusterButton.disabled = true;
            stopButton.classList.remove('d-none');
            processingStatusElement.textContent = 'Processing...';
            processingStatusElement.classList.add('processing');
            uploadProgress.classList.remove('d-none');
            startTimer();
            
            // Clear previous error log
            errorLog = [];
            errorLogContent.innerHTML = '';
            
            // Read and parse CSV
            const file = csvFile.files[0];
            logError(`Processing file: ${file.name}`);
            keywords = await parseCSV(file);
            totalKeywordsElement.textContent = keywords.length;

            // Parse and validate suggested clusters
            const suggestedClustersList = parseSuggestedClusters(suggestedClusters.value);
            if (suggestedClustersList && !validateSuggestedClusters(suggestedClustersList, keywords)) {
                clusterError.classList.remove('d-none');
                throw new Error('Invalid suggested clusters');
            }
            clusterError.classList.add('d-none');

            // Process keywords in batches
            currentClusters = await processKeywordsInBatches(keywords, suggestedClustersList);
            
            // Display results
            displayClusters(currentClusters);
            totalClustersElement.textContent = currentClusters.length;
            
            processingStatusElement.textContent = 'Complete';
            processingStatusElement.classList.remove('processing');
            stopTimer();
            downloadButton.classList.remove('d-none');
            downloadTSVButton.classList.remove('d-none');
            copyCSVButton.classList.remove('d-none');
            copyTSVButton.classList.remove('d-none');
            clusterButton.disabled = false;
            stopButton.classList.add('d-none');
        } catch (error) {
            logError('Error in main processing loop', error);
            console.error('Error:', error);
            processingStatusElement.textContent = 'Error occurred';
            alert('An error occurred while processing the keywords');
            resetUI();
        }
    });

    async function parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const csv = event.target.result;
                    const lines = csv.split('\n');
                    const headers = lines[0].split(',').map(h => h.trim());
                    
                    logError(`CSV Headers: ${headers.join(', ')}`);
                    
                    // Try to identify keyword and volume columns
                    let keywordIndex = -1;
                    let volumeIndex = -1;
                    
                    // First try exact matches
                    keywordIndex = headers.findIndex(h => 
                        h.toLowerCase().includes('keyword') || 
                        h.toLowerCase().includes('search term') ||
                        h.toLowerCase().includes('query')
                    );
                    volumeIndex = headers.findIndex(h => 
                        h.toLowerCase().includes('volume') || 
                        h.toLowerCase().includes('search volume') ||
                        h.toLowerCase().includes('impressions')
                    );

                    // If not found, try fuzzy matching with LLM
                    if (keywordIndex === -1 || volumeIndex === -1) {
                        const columnPrompt = `Analyze these CSV headers and identify which columns contain keyword/search terms and volume data. Headers: ${headers.join(', ')}. Return JSON format: {"keywordIndex": number, "volumeIndex": number}`;
                        
                        try {
                            const response = await callLLM(columnPrompt);
                            const columnMapping = JSON.parse(response);
                            if (columnMapping.keywordIndex !== undefined) keywordIndex = columnMapping.keywordIndex;
                            if (columnMapping.volumeIndex !== undefined) volumeIndex = columnMapping.volumeIndex;
                        } catch (error) {
                            logError('Error identifying columns with LLM', error);
                        }
                    }

                    // If still not found, use first column for keywords and second for volume
                    if (keywordIndex === -1) keywordIndex = 0;
                    if (volumeIndex === -1) volumeIndex = 1;

                    const keywords = lines.slice(1)
                        .filter(line => line.trim())
                        .map((line, index) => {
                            try {
                                const columns = line.split(',').map(item => item.trim());
                                const keyword = columns[keywordIndex];
                                const volume = columns[volumeIndex] ? parseInt(columns[volumeIndex]) : null;

                                if (!keyword) {
                                    logError(`Empty keyword found at line ${index + 2}`);
                                    return null;
                                }

                                return {
                                    keyword,
                                    volume
                                };
                            } catch (err) {
                                logError(`Error parsing line ${index + 2}: ${line}`, err);
                                return null;
                            }
                        })
                        .filter(item => item !== null);

                    logError(`Successfully parsed ${keywords.length} keywords`);
                    resolve(keywords);
                } catch (error) {
                    logError('Error processing CSV file', error);
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                logError('Error reading CSV file', error);
                reject(error);
            };
            reader.readAsText(file);
        });
    }

    async function processKeywordsInBatches(keywords, suggestedClustersList = null) {
        const clusters = new Map();
        const batches = createBatches(keywords, BATCH_SIZE);
        totalBatches = batches.length;
        
        for (let i = 0; i < batches.length; i++) {
            if (!isProcessing) break;
            
            currentBatchIndex = i;
            const batch = batches[i];
            const batchClusters = await processBatch(batch, suggestedClustersList);
            
            // Merge batch clusters with main clusters
            mergeClusters(clusters, batchClusters);
            
            // Update progress
            const progress = ((i + 1) / batches.length) * 100;
            progressBar.style.width = `${progress}%`;
            progressInfoElement.textContent = `${i + 1}/${batches.length} chunks`;
            
            // Update ETA
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            updateETA(i + 1, batches.length, elapsedSeconds);
        }

        return Array.from(clusters.values());
    }

    function createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    async function processBatch(batch, suggestedClustersList = null) {
        try {
            const prompt = createPrompt(batch, suggestedClustersList);
            const response = await callLLM(prompt);
            const clusters = parseLLMResponse(response);
            
            if (!Array.isArray(clusters)) {
                logError('Invalid cluster format received from LLM', new Error('Clusters must be an array'));
                return [];
            }

            clusters.forEach((cluster, index) => {
                if (!cluster.name || !Array.isArray(cluster.keywords) || !cluster.type) {
                    logError(`Invalid cluster format at index ${index}`, new Error(JSON.stringify(cluster)));
                }
            });

            return clusters;
        } catch (error) {
            logError('Error processing batch', error);
            return [];
        }
    }

    async function callLLM(prompt) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getApiKey()}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a keyword clustering expert. Create precise, specific clusters based on exact themes and distinguish between paid and organic intent.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            throw new Error('API call failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    function parseLLMResponse(response) {
        try {
            const parsed = JSON.parse(response);
            return parsed.clusters;
        } catch (error) {
            console.error('Error parsing LLM response:', error);
            return [];
        }
    }

    function mergeClusters(mainClusters, batchClusters) {
        try {
            batchClusters.forEach(batchCluster => {
                if (!batchCluster.name || !Array.isArray(batchCluster.keywords)) {
                    logError('Invalid batch cluster format', new Error(JSON.stringify(batchCluster)));
                    return;
                }

                const existingCluster = Array.from(mainClusters.values())
                    .find(c => c.name === batchCluster.name);

                if (existingCluster) {
                    existingCluster.keywords.push(...batchCluster.keywords);
                    logError(`Merged ${batchCluster.keywords.length} keywords into existing cluster: ${batchCluster.name}`);
                } else {
                    mainClusters.set(batchCluster.name, batchCluster);
                    logError(`Created new cluster: ${batchCluster.name} with ${batchCluster.keywords.length} keywords`);
                }
            });
        } catch (error) {
            logError('Error merging clusters', error);
        }
    }

    function displayClusters(clusters) {
        clusterResults.innerHTML = '';

        // Group clusters by type
        const paidClusters = clusters.filter(c => c.type === 'paid');
        const organicClusters = clusters.filter(c => c.type === 'organic');

        // Display paid clusters first
        if (paidClusters.length > 0) {
            displayClusterGroup(paidClusters, 'paid');
        }

        // Display organic clusters
        if (organicClusters.length > 0) {
            displayClusterGroup(organicClusters, 'organic');
        }
    }

    function displayClusterGroup(clusters, type) {
        const container = document.createElement('div');
        container.className = 'cluster-section';
        
        const header = document.createElement('h2');
        header.className = 'section-header';
        header.textContent = type === 'paid' ? 'Paid Intent Clusters' : 'Organic Intent Clusters';
        container.appendChild(header);

        clusters.forEach(cluster => {
            const clusterDiv = document.createElement('div');
            clusterDiv.className = 'cluster';
            
            const clusterHeader = document.createElement('div');
            clusterHeader.className = 'cluster-header';
            
            const clusterTitle = document.createElement('div');
            clusterTitle.className = 'cluster-title';
            const clusterVolume = calculateClusterVolume(cluster.keywords);
            clusterTitle.innerHTML = `
                <span class="cluster-name">${cluster.name}</span>
                <span class="keyword-count">(${cluster.keywords.length} keywords)</span>
                <span class="cluster-volume">• <strong>${clusterVolume.toLocaleString()} total volume</strong></span>
            `;
            
            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-button';
            toggleButton.innerHTML = '▼';
            toggleButton.onclick = () => {
                const content = clusterDiv.querySelector('.cluster-content');
                const isExpanded = content.style.display === 'block';
                content.style.display = isExpanded ? 'none' : 'block';
                toggleButton.innerHTML = isExpanded ? '▼' : '▲';
            };
            
            clusterHeader.appendChild(clusterTitle);
            clusterHeader.appendChild(toggleButton);
            
            const content = document.createElement('div');
            content.className = 'cluster-content';
            content.style.display = 'none'; // Start minimized
            
            const keywordList = document.createElement('ul');
            keywordList.className = 'keyword-list';
            
            cluster.keywords.forEach(keyword => {
                const keywordData = keywords.find(k => k.keyword === keyword);
                const volume = keywordData?.volume || '';
                const li = document.createElement('li');
                li.textContent = `${keyword}${volume ? ` (${volume})` : ''}`;
                keywordList.appendChild(li);
            });
            
            content.appendChild(keywordList);
            clusterDiv.appendChild(clusterHeader);
            clusterDiv.appendChild(content);
            container.appendChild(clusterDiv);
        });
        
        clusterResults.appendChild(container);
    }

    function calculateClusterVolume(clusterKeywords) {
        return clusterKeywords.reduce((total, keyword) => {
            const keywordData = keywords.find(k => k.keyword === keyword);
            return total + (keywordData?.volume || 0);
        }, 0);
    }

    // Add copy to clipboard functionality
    function copyToClipboard(format = 'csv') {
        if (!currentClusters.length) return;

        // Create content with headers
        const headers = 'Cluster Type,Cluster Name,Cluster Volume,Keyword,Keyword Volume';
        let content = headers + '\n';
        
        // Group clusters by type
        const paidClusters = currentClusters.filter(c => c.type === 'paid');
        const organicClusters = currentClusters.filter(c => c.type === 'organic');

        // Process paid clusters
        paidClusters.forEach(cluster => {
            const clusterVolume = calculateClusterVolume(cluster.keywords);
            cluster.keywords.forEach((keyword, index) => {
                const keywordData = keywords.find(k => k.keyword === keyword);
                const keywordVolume = keywordData?.volume || '';
                // Only include cluster name and volume in first row of each cluster
                const clusterName = index === 0 ? cluster.name : '';
                const clusterVolumeDisplay = index === 0 ? clusterVolume : '';
                content += `Paid,${clusterName},${clusterVolumeDisplay},${keyword},${keywordVolume}\n`;
            });
        });

        // Process organic clusters
        organicClusters.forEach(cluster => {
            const clusterVolume = calculateClusterVolume(cluster.keywords);
            cluster.keywords.forEach((keyword, index) => {
                const keywordData = keywords.find(k => k.keyword === keyword);
                const keywordVolume = keywordData?.volume || '';
                // Only include cluster name and volume in first row of each cluster
                const clusterName = index === 0 ? cluster.name : '';
                const clusterVolumeDisplay = index === 0 ? clusterVolume : '';
                content += `Organic,${clusterName},${clusterVolumeDisplay},${keyword},${keywordVolume}\n`;
            });
        });

        // Convert to TSV if needed
        if (format === 'tsv') {
            content = content.split('\n').map(line => 
                line.split(',').map(cell => 
                    cell.includes(',') ? `"${cell}"` : cell
                ).join('\t')
            ).join('\n');
        }

        // Copy to clipboard
        navigator.clipboard.writeText(content).then(() => {
            alert(`Content copied to clipboard in ${format.toUpperCase()} format`);
        }).catch(err => {
            logError('Error copying to clipboard', err);
            alert('Failed to copy to clipboard');
        });
    }

    // Update the HTML to add copy buttons
    const copyCSVButton = document.createElement('button');
    copyCSVButton.id = 'copyCSVButton';
    copyCSVButton.className = 'btn btn-info d-none';
    copyCSVButton.textContent = 'Copy CSV';
    copyCSVButton.onclick = () => copyToClipboard('csv');
    document.querySelector('.button-group').appendChild(copyCSVButton);

    const copyTSVButton = document.createElement('button');
    copyTSVButton.id = 'copyTSVButton';
    copyTSVButton.className = 'btn btn-info d-none';
    copyTSVButton.textContent = 'Copy TSV';
    copyTSVButton.onclick = () => copyToClipboard('tsv');
    document.querySelector('.button-group').appendChild(copyTSVButton);
}); 