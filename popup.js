// Add this debounce function at the top of your file
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function getFingerprint() {
    // Ensure FingerprintJS is loaded
    if (typeof FingerprintJS === 'undefined') {
        console.error('FingerprintJS is not loaded');
        return null;
    }
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
}

function displayError(errorMessage) {
    const resultContainer = document.getElementById('resultContainer');
    const summaryContainer = document.getElementById('summaryContainer');
    const resultDiv = document.getElementById('resultDiv');
    const copyButton = document.getElementById('copyButton');
    const summaryHeader = document.querySelector('.summary-header');
    
    // Hide summary-related elements
    if (summaryContainer) summaryContainer.style.display = 'none';
    if (copyButton) copyButton.style.display = 'none';
    if (summaryHeader) summaryHeader.style.display = 'none';
    
    // Clear previous content
    if (resultDiv) resultDiv.innerHTML = '';
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message user-friendly';
    errorDiv.innerHTML = `
        <h3>Oops!</h3>
        <p>${errorMessage}</p>
    `;
    
    if (resultDiv) resultDiv.appendChild(errorDiv);
    if (resultContainer) resultContainer.style.display = 'block';

    // Only add the "Open Settings" button if it's the API key error
    if (errorMessage.includes('Enter your API key')) {
        const openSettingsBtn = document.createElement('button');
        openSettingsBtn.id = 'openSettingsBtn';
        openSettingsBtn.className = 'action-button';
        openSettingsBtn.textContent = 'Open Settings';
        openSettingsBtn.addEventListener('click', function() {
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal) {
                settingsModal.style.display = 'block';
                loadApiKeysIntoSettingsForm();
            }
        });
        errorDiv.appendChild(openSettingsBtn);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const modelSelect = document.getElementById('modelSelect');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const resultDiv = document.getElementById('resultDiv');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const copyButton = document.getElementById('copyButton');
    const ttsButton = document.getElementById('ttsButton');
    const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
    const exportButton = document.getElementById('exportButton');
    const inputContainer = document.getElementById("inputContainer");
    const loaderContainer = document.getElementById("loaderContainer");
    const darkModeToggle = document.getElementById('darkModeToggle');
    let lastInput = '';
    let lastModel = '';
    let currentAudio = null;
    let preloadedAudio = null;
    let isPreloading = false;
    let ttsEndpointUrl = 'https://summariser-test-f7ab30f38c51.herokuapp.com/tts'; // Default URL
    let currentActivityId = null;
    let activityData = {};
    let lastActivityType = null;
    let lastActivityTime = 0;
    let currentSessionId = null;
    feather.replace();
    
    fetchTtsEndpointUrl();

    // Check for saved dark mode preference
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
    }

    // Dark mode toggle functionality
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
        } else {
            localStorage.setItem('darkMode', null);
        }
    });

    function charCounter(inputField) {
        const maxLength = inputField.getAttribute("maxlength");
        const currentLength = inputField.value.length;
        const progressBar = document.getElementById("progress-bar");
        const remChars = document.getElementById("remaining-chars");
        const progressContainer = document.getElementById("progressContainer");
        const progressWidth = (currentLength / maxLength) * 100;
        progressBar.style.width = `${progressWidth}%`;
        remChars.style.display = "none";
    
        if (progressWidth <= 60) {
            progressBar.style.backgroundColor = "rgb(19, 160, 19)";
        } else if (progressWidth > 60 && progressWidth < 85) {
            progressBar.style.backgroundColor = "rgb(236, 157, 8)";
        } else {
            progressBar.style.backgroundColor = "rgb(241, 9, 9)";
            remChars.innerHTML = `${maxLength - currentLength} characters left`;
            remChars.style.display = "block";
        }
    
        // Show progress container only when there's input
        progressContainer.style.display = currentLength > 0 ? "block" : "none";
    }
    
    inputText.oninput = () => charCounter(inputText);
    
    // Initially hide the progress container
    const progressContainer = document.getElementById("progressContainer");
    progressContainer.style.display = "none";
    

// Update the export button event listener
if (exportButton) {
    exportButton.addEventListener('click', debounce(function() {
        exportSummary();
        updateActivity('summary_exported');
    }, 300)); // 300ms debounce time
}


    function showToast(message) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = 'show';
        setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
    }

    function showWelcomeToast(message) {
        showToast(message);
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                disableForReducedMotion: true
            });
        } else {
            console.warn('Confetti function not available');
        }
    }

    async function getApiKey(keyName) {
        return new Promise((resolve) => {
            chrome.storage.local.get([keyName], function(result) {
                const apiKey = result[keyName];
                if (apiKey && apiKey.trim() !== '') {
                    resolve(apiKey);
                } else {
                    resolve(null);
                }
            });
        });
    }

    function openSettingsModal() {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.style.display = 'block';
            loadApiKeysIntoSettingsForm();
        }
    }

    async function fetchUrlContent(url) {
        try {
            const response = await fetch(url);
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                return doc.body.innerText;
            } else {
                return await response.text();
            }
        } catch (error) {
            throw error;
        }
    }

    async function sendSummarizeRequest(input, model, apiKey) {
        try {
            const userId = await getUserId();
            let requestData = { 
                input, 
                model, 
                user_id: userId
            };

            if (apiKey) {
                requestData.api_key = apiKey;
            }

            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.summary) {
                return data.summary;
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            // Instead of logging to console, we'll throw the error to be handled by the caller
            throw new Error(`Failed to summarize: ${error.message}`);
        }
    }

    function debugLog(message) {
        // Debug logging removed for production
    }

    async function getUserId() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['userId'], function(result) {
                if (result.userId) {
                    resolve(result.userId);
                } else {
                    const newUserId = generateUUID();
                    chrome.storage.sync.set({userId: newUserId}, function() {
                        resolve(newUserId);
                    });
                }
            });
        });
    }
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    

    function beautifySummary(summary) {
        // Split the summary into paragraphs
        const paragraphs = summary.split('\n').filter(p => p.trim() !== '');
        
        // Create HTML for each paragraph
        const htmlParagraphs = paragraphs.map(p => `<p>${p}</p>`).join('');
        
        return htmlParagraphs;
    }

    
    function showLoader() {
        if (loaderContainer) {
            loaderContainer.style.display = 'flex';
            // Hide other elements
            document.getElementById('resultContainer').style.display = 'none';
            inputContainer.style.display = 'none';
            progressContainer.style.display = 'none';
            modelSelect.style.display = 'none';
            summarizeBtn.style.display = 'none';
        }
    }
    
    function hideLoader() {
        if (loaderContainer) {
            loaderContainer.style.display = 'none';
            // Show other elements
            inputContainer.style.display = 'block';
            progressContainer.style.display = 'block';
            modelSelect.style.display = 'inline-block';
            summarizeBtn.style.display = 'inline-block';
            // resultContainer will be shown by displaySummary or displayError
        }
    }
    
    // Your existing charCounter function remains the same
    
    // Update your summarize function to use showLoader and hideLoader
    async function summarize() {
        showLoader();
        try {
            // Your existing summarization logic
        } catch (error) {
            // Error handling
        } finally {
            hideLoader();
        }
    }
    
    // Make sure to call summarize when the summarize button is clicked
    document.getElementById('summarizeBtn').addEventListener('click', summarize);

    function toggleSummarizeButton(disabled) {
        if (summarizeBtn) {
            summarizeBtn.disabled = disabled;
            summarizeBtn.style.opacity = disabled ? '0.5' : '1';
            summarizeBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
    }

    function isInputValid(input) {
        const minLength = 200; // Minimum length for text input
        const urlPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    
        ////console.log("Validating input:", input);
    
        // Check if the input contains URLs
        const urlMatches = input.match(urlPattern);
        
        if (urlMatches) {
            ////console.log("URLs detected:", urlMatches.length);
            if (urlMatches.length > 1) {
                displayError('Please enter only one URL or paste the privacy policy text directly. Multiple URLs are not supported.');
                return false;
            }
            return true; // Single URL is valid
        }
    
        // For non-URL input, check the length
        if (input.trim().length < minLength) {
            ////console.log("Input too short:", input.trim().length, "characters");
            displayError(`Please enter at least ${minLength} characters or a valid URL.`);
            return false;
        }
    
        ////console.log("Valid text input");
        return true;
    }


    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', async function(event) {
            event.preventDefault();
            const input = inputText.value.trim();
            ////console.log("Input:", input);
            if (isInputValid(input)) {
                if (await checkApiKeyAndOpenSettings()) {
                    debounce(summarize, 300)();
                }
            }
        });
    }

    const maxRetries = 3;

    async function summarize() {
        try {
            if (!(await checkApiKeyAndOpenSettings())) {
                return;
            }
            const inputText = document.getElementById('inputText').value.trim();
            const model = document.getElementById('modelSelect').value;
            const userId = await getUserId();
            let token = await getValidToken();
            const startTime = Date.now();
    
            if (!inputText) {
                displayError('Please enter some text or a URL to summarize.');
                return;
            }
    
            const maxInputLength = 50000;
            if (inputText.length > maxInputLength) {
                displayError(`Input is too long. Please limit your input to ${maxInputLength} characters.`);
                return;
            }
    
            const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
            const urlMatches = inputText.match(urlRegex);
    
            if (urlMatches && urlMatches.length > 1) {
                displayError('Please enter only one URL or paste the privacy policy text directly. Multiple URLs are not supported.');
                return;
            }
    
            showLoader();
            let isUrl = false;
            let scrapedContent = null;
    
            if (urlMatches && urlMatches.length === 1) {
                isUrl = true;
                const url = urlMatches[0];
                try {
                    scrapedContent = await scrapeWebsite(url);
                } catch (error) {
                    displayError(`Failed to scrape website: ${error.message}`);
                    return;
                }
            } else if (inputText.includes('http://') || inputText.includes('https://')) {
                displayError('Invalid URL format. Please enter a valid URL or paste the privacy policy text directly.');
                return;
            }
    
            if (!isInputValid(inputText)) {
                return; // The error message is already displayed by isInputValid
            }
    
            const freeSummariesLeft = await getFreeSummariesCount();
            let apiKey = await getApiKey(`${model}ApiKey`);
    
            if (freeSummariesLeft <= 0 && !apiKey) {
                throw new Error('No free summaries left and no valid API key provided');
            }
    
            const useServerSideKey = freeSummariesLeft > 0;
            let response;
            for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
                try {
                    response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/summarize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            input: inputText,
                            model: model,
                            user_id: userId,
                            is_url: isUrl,
                            searched_data: inputText,
                            scrape_data: scrapedContent,
                            api_key: useServerSideKey ? 'server_side' : apiKey
                        })
                    });
    
                    if (response.ok) {
                        break;
                    }
    
                    const errorData = await response.json();
                    if (response.status === 400 && errorData.error.includes("Failed to scrape website content")) {
                        throw new Error('Unable to access the website content. Please try pasting the privacy policy text directly.');
                    } else if (response.status === 403 && errorData.error === "No free summaries left") {
                        throw new Error('No free summaries left');
                    } else if (response.status === 503) {
                        if (retryCount === maxRetries - 1) {
                            throw new Error('Server temporarily unavailable. Please try again later.');
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    } else if (response.status === 403) {
                        console.log('Received 403 error, attempting to refresh token');
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Add a 1-second delay
                        token = await requestNewToken();
                        if (!token) {
                            throw new Error('Failed to refresh authentication token');
                        }
                    } else {
                        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                    }
                } catch (error) {
                    if (retryCount === maxRetries - 1) {
                        throw error; // Rethrow the error if it's the last retry
                    }
                    console.error(`Attempt ${retryCount + 1} failed:`, error);
                }
            }
    
            if (!response || !response.ok) {
                throw new Error('Failed to get a valid response after retries');
            }
    
            const result = await response.json();
    
            if (result.error) {
                throw new Error(result.error);
            }
    
            displaySummary(result.summary, model);
            updateFreeSummariesDisplay(result.free_summaries_left);
            currentSessionId = result.session_id;  // Store the session_id
    
            // Start a new session here
            startNewSession({
                model: model,
                isUrl: isUrl,
                input: inputText,
                scrapeData: scrapedContent
            });
            
            const activityData = {
                model_selected: model,
                searched_for: isUrl ? 'url' : 'text',
                searched_data: inputText,
                scrape_data: scrapedContent,
                request_time: (Date.now() - startTime) / 1000, // Convert to seconds
                tts_used: false,
                copied_summary: false,
                summary_exported: false
            };
            // Reset activity flags
            lastActivityType = null;
            lastActivityTime = 0;
            await sendUserActivity(activityData);
    
        } catch (error) {
            console.error('Summarize error:', error);
            if (error.message.includes('Unable to access the website content')) {
                displayError('Unable to access the website content. Please try pasting the privacy policy text directly.');
            } else if (error.message.includes('No free summaries left')) {
                displayError('You have used all your free summaries. Please enter your API key to continue.');
                openSettingsModal();
            } else if (error.message === 'Server temporarily unavailable. Please try again later.') {
                displayError('Server is temporarily unavailable. Please try again in a few moments.');
            } else {
                displayError(`Failed to summarize: ${error.message}`);
            }
        } finally {
            hideLoader();
        }
    }

    async function checkApiKeyAndOpenSettings() {
        const model = document.getElementById('modelSelect').value;
        const freeSummariesLeft = await getFreeSummariesCount();
        const apiKey = await getApiKey(`${model}ApiKey`);
    
        ////console.log('Model:', model);
        ////console.log('Free summaries left:', freeSummariesLeft);
        ////console.log('API Key exists:', !!apiKey);
    
        if (freeSummariesLeft <= 0 && !apiKey) {
            displayError('You have used all your free summaries. Please enter your API key to continue.');
            openSettingsModal();
            return false;
        }
        return true;
    }

    async function scrapeWebsite(url) {
        try {
            const token = await getValidToken();
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url: url })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            return data.content;
        } catch (error) {
            console.error('Error scraping website:', error);
            throw error;
        }
    }

    async function getFreeSummariesCount() {
        try {
            const token = await getValidToken();
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_free_summaries_count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    user_id: await getUserId()
                })
            });
            if (response.status === 403) {
                return 0; // No free summaries left
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.free_summaries_left !== undefined ? data.free_summaries_left : 0;
        } catch (error) {
            console.error('Error fetching free summaries count:', error);
            return 0;
        }
    }

    function closeSettingsModal() {
        if (settingsModal) {
            settingsModal.style.display = 'none';
        }
    }

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', function() {
            settingsModal.style.display = 'block';
            loadApiKeysIntoSettingsForm();
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent any default action
            event.stopPropagation(); // Stop the event from bubbling up
            closeSettingsModal();
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function() {
            const gpt4oMiniApiKey = document.getElementById('gpt4oMiniApiKeyInput').value;
            const claudeApiKey = document.getElementById('claudeApiKeyInput').value;
            const geminiApiKey = document.getElementById('geminiApiKeyInput').value;
            const mistralApiKey = document.getElementById('mistralApiKeyInput').value;
            const newVoice = document.getElementById('ttsVoiceSelect').value;

            chrome.storage.local.set({
                'gpt-4o-miniApiKey': gpt4oMiniApiKey,
                'claude-3-5-sonnet-20240620ApiKey': claudeApiKey,
                'gemini-1.5-flash-8bApiKey': geminiApiKey,
                'mistral-small-latestApiKey': mistralApiKey,
                'ttsVoice': newVoice
            }, function() {
                closeSettingsModal();
                updateModelSelectOptions();
                showToast("Settings saved successfully!");
            });
        });
    }

    if (settingsModal) {
        window.addEventListener('click', function(event) {
            if (event.target == settingsModal) {
                closeSettingsModal();
            }
        });
    }

    function formatSummary(summary) {
        // Remove any leading HTML tags
        summary = summary.replace(/^<[^>]+>/, '');

        const sections = summary.split(/<h[1-6]>/);
        let formattedSummary = '<div class="summary-content">';

        sections.forEach((section, index) => {
            if (section.trim()) {
                const [title, ...content] = section.split('</h');
                if (index > 0) { // Skip the first split as it's before the first header
                    const headerLevel = summary.match(new RegExp(`<h(\\d)>${title}`))[1];
                    formattedSummary += `<h${headerLevel}>${title}</h${headerLevel}>`;
                }
                
                if (content.length > 0) {
                    const contentText = content.join('</h'); // Rejoin any accidental splits
                    const listItems = contentText.split(/(?:^|\n)[-•]/);
                    
                    if (listItems.length > 1) {
                        formattedSummary += '<ul>';
                        listItems.forEach((item) => {
                            const trimmedItem = item.trim();
                            if (trimmedItem) {
                                formattedSummary += `<li>${trimmedItem}</li>`;
                            }
                        });
                        formattedSummary += '</ul>';
                    } else {
                        formattedSummary += `<p>${contentText.trim()}</p>`;
                    }
                }
            }
        });

        formattedSummary += '</div>';
        return formattedSummary;
    }

    function displaySummary(summary, model) {
        const resultContainer = document.getElementById('resultContainer');
        const summaryContainer = document.getElementById('summaryContainer');
        const resultDiv = document.getElementById('resultDiv');
        const copyButton = document.getElementById('copyButton');
        const summaryHeader = document.querySelector('.summary-header');
        
        // Show summary-related elements
        summaryContainer.style.display = 'block';
        copyButton.style.display = 'inline-block';
        summaryHeader.style.display = 'flex';
        
        // Clear previous content
        summaryContainer.innerHTML = '';
        resultDiv.innerHTML = '';
        
        // Add this line to standardize the response
        const standardizedSummary = standardizeModelResponse(summary, model);

        // Then use standardizedSummary instead of summary when setting the HTML content
        summaryContainer.innerHTML = standardizedSummary;
        
        // Add the disclaimer
        resultDiv.innerHTML = `
            <div class="disclaimer">
                <h4>Disclaimer:</h4>
                <p>This tool is for informational purposes only. Always read the full privacy policy for complete information.</p>
            </div>
        `;
        
        resultContainer.style.display = 'block';

        showToast("Preparing audio. It will be available soon.");
        preloadAudioWithCurrentSettings();
    }

    function updateFreeSummariesDisplay(count) {
        const counterElement = document.getElementById('freeSummariesCounter');
        if (counterElement) {
            const newCount = Math.max(0, count);
            counterElement.textContent = `Free summaries left: ${newCount}`;
            counterElement.style.display = 'block';
        }
    }

    async function fetchAndUpdateFreeSummariesCount() {
        try {
            const userId = await getUserId();
            const token = await getValidToken();
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_free_summaries_count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    user_id: userId
                })
            });
            const data = await response.json();
            const count = data.free_summaries_left !== undefined ? data.free_summaries_left : 0;
            updateFreeSummariesDisplay(count);
            return count;
        } catch (error) {
            console.error('Error fetching free summaries count:', error);
            updateFreeSummariesDisplay(0);
            return 0;
        }
    }

    // Add this function to check for saved API keys and update the model select options
    async function updateModelSelectOptions() {
        const modelSelect = document.getElementById('modelSelect');
        const models = [
            { value: 'gpt-4o-mini', name: 'GPT-4o-mini', keyName: 'gpt-4o-miniApiKey' },
            { value: 'claude-3-5-sonnet-20240620', name: 'Claude', keyName: 'claude-3-5-sonnet-20240620ApiKey' },  // Updated model name
            { value: 'gemini-1.5-flash-8b', name: 'Gemini', keyName: 'gemini-1.5-flash-8bApiKey' },
            { value: 'mistral-small-latest', name: 'Mistral', keyName: 'mistral-small-latestApiKey' }
        ];

        // Clear existing options
        modelSelect.innerHTML = '';

        for (const model of models) {
            const apiKey = await getApiKey(model.keyName);
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = `${model.name}${apiKey ? ' (Key Set)' : ''}`;
            modelSelect.appendChild(option);
        }
    }

    // Call this function when the popup is loaded
    updateModelSelectOptions();

    // Add this function to handle the copy button
    if (copyButton) {
        copyButton.addEventListener('click', debounce(function() {
            const summaryContainer = document.getElementById('summaryContainer');
            if (summaryContainer) {
                const summaryText = summaryContainer.innerText;
                navigator.clipboard.writeText(summaryText).then(() => {
                    showToast("Summary copied to clipboard!");
                    updateActivity('copied_summary');
                }).catch(err => {
                    console.error('Failed to copy summary: ', err);
                    showToast("Failed to copy summary. Please try again.");
                });
            } else {
                console.error('Summary container not found');
                showToast("Error: Summary not available");
            }
        }, 300)); // 300ms debounce time
    }

    // Add this function to load API keys into the settings form
    function loadApiKeysIntoSettingsForm() {
        chrome.storage.local.get(['gpt-4o-miniApiKey', 'claude-3-5-sonnet-20240620ApiKey', 'gemini-1.5-flash-8bApiKey', 'mistral-small-latestApiKey'], function(result) {
            const gpt4oMiniInput = document.getElementById('gpt4oMiniApiKeyInput');
            const claudeInput = document.getElementById('claudeApiKeyInput');
            const geminiInput = document.getElementById('geminiApiKeyInput');
            const mistralInput = document.getElementById('mistralApiKeyInput');
    
            if (gpt4oMiniInput) gpt4oMiniInput.value = result['gpt-4o-miniApiKey'] || '';
            if (claudeInput) claudeInput.value = result['claude-3-5-sonnet-20240620ApiKey'] || '';
            if (geminiInput) geminiInput.value = result['gemini-1.5-flash-8bApiKey'] || '';
            if (mistralInput) mistralInput.value = result['mistral-small-latestApiKey'] || '';
        });
    }

    // Load saved voice preference
    chrome.storage.local.get(['ttsVoice'], function(result) {
        if (result.ttsVoice) {
            ttsVoiceSelect.value = result.ttsVoice;
        }
    });

    // Save voice preference when changed
    ttsVoiceSelect.addEventListener('change', function() {
        const newVoice = ttsVoiceSelect.value;
        chrome.storage.local.set({ ttsVoice: newVoice }, function() {
            showToast("Voice updated. Preparing new audio...");
            preloadAudioWithCurrentSettings();
        });
    });

    ttsButton.addEventListener('click', function() {
        if (currentAudio) {
            if (currentAudio.paused) {
                currentAudio.play().catch(e => {
                    showToast("Error playing audio. Please try again.");
                });
                ttsButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                `;
            } else {
                currentAudio.pause();
                ttsButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                `;
            }
        } else if (preloadedAudio) {
            currentAudio = preloadedAudio;
            currentAudio.play().catch(e => {
                showToast("Error playing audio. Please try again.");
            });
            ttsButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            `;

            currentAudio.onended = function() {
                ttsButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                `;
                currentAudio = null;
            };
        } else if (isPreloading) {
            showToast("Audio is being prepared. Please wait a moment and try again.");
        } else {
            showToast("Audio is not available. Please generate a new summary and try again.");
            preloadAudioWithCurrentSettings(); // Attempt to preload audio again
        }
    });

    function standardizeModelResponse(response, model) {
        let standardizedResponse = response;

        // Remove introductory text
        tandardizedResponse = standardizedResponse.replace(/^(Here's a summary of the privacy policy.*?:?\s*)?(based on the requested categories:\s*)?/i, '');

        // Remove concluding phrases
        standardizedResponse = standardizedResponse.replace(/\s*(Let me know if|If you have any|Please let me know|Is there anything else).*?$/i, '');

        // Convert problematic characters to proper bullet points
        standardizedResponse = standardizedResponse
            .replace(/â€¢/g, '•')
            .replace(/[\u2022\u2023\u2043]/g, '•')
            .trim();

        // Standardize headers (including ###)
        standardizedResponse = standardizedResponse.replace(/^(#{1,6})\s*(.*?)$/gm, (match, hashes, title) => {
            const level = Math.min(hashes.length, 6); // Ensure header level is between 1 and 6
            return `<h${level}>${title.trim()}</h${level}>`;
        });

        // Handle headers with ** and convert to proper HTML headers
        standardizedResponse = standardizedResponse.replace(/^\*\*(.*?)\*\*$/gm, (match, content) => {
        return `<h3>${content.trim()}</h3>`;
        });
        // Handle inline bold text (if any remains after header conversion)
        standardizedResponse = standardizedResponse.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Convert numbered lists to HTML ordered lists
        let inOrderedList = false;
        standardizedResponse = standardizedResponse.split('\n').map((line, index, array) => {
            const trimmedLine = line.trim();
            const numberMatch = trimmedLine.match(/^(\d+)\.\s(.*)$/);
            if (numberMatch) {
                if (!inOrderedList) {
                    inOrderedList = true;
                    return `<ol><li>${numberMatch[2]}</li>`;
                }
                return `<li>${numberMatch[2]}</li>`;
            } else if (inOrderedList) {
                inOrderedList = false;
                return `</ol>${line}`;
            } else {
                return line;
            }
        }).join('\n');

        if (inOrderedList) {
            standardizedResponse += '</ol>';
        }

       // Convert bullet points to HTML list items
       let inList = false;
       standardizedResponse = standardizedResponse.split('\n').map(line => {
           const trimmedLine = line.trim();
        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
            if (!inList) {
                inList = true;
                return '<ul><li>' + trimmedLine.substring(2) + '</li>';
            }
            return '<li>' + trimmedLine.substring(2) + '</li>';
        } else if (inList) {
            inList = false;
            return '</ul>' + line;
        } else {
            return '<p>' + line + '</p>';
            }
        }).join('');

        if (inList) {
            standardizedResponse += '</ul>';
        }

        // Wrap the entire response in a summary-content div
        standardizedResponse = `<div class="summary-content">${standardizedResponse}</div>`;

        return standardizedResponse;
    }

    // Update the preloadAudio function to handle GPT TTS response
    function preloadAudio(text, voice, callback) {
        isPreloading = true;
        showToast("Preparing audio. It will be available soon.");
        
        fetch(ttsEndpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voice: voice
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                });
            }
            return response.blob();
        })
        .then(blob => {
            if (blob.type === 'audio/mpeg') {
                const audioUrl = URL.createObjectURL(blob);
                preloadedAudio = new Audio(audioUrl);
                preloadedAudio.onerror = function(e) {
                    throw new Error('Failed to load audio');
                };
                preloadedAudio.oncanplaythrough = function() {
                    isPreloading = false;
                    showToast("Audio is ready to play!");
                    if (callback) callback(preloadedAudio);
                    updateActivity('tts');  // Add this line to track TTS usage
                };
            } else {
                throw new Error(`Received non-audio blob: ${blob.type}`);
            }
        })
        .catch(error => {
            isPreloading = false;
            showToast(`Failed to prepare audio: ${error.message}`);
            if (callback) callback(null);
        });
    }

    function preloadAudioWithCurrentSettings() {
        const summaryContainer = document.getElementById('summaryContainer');
        const resultDiv = document.getElementById('resultDiv');
        
        if (summaryContainer && resultDiv) {
            const summaryText = summaryContainer.innerText;
            const disclaimerText = resultDiv.innerText;
            const fullText = summaryText + ' ' + disclaimerText;
    
            chrome.storage.local.get(['ttsVoice'], function(result) {
                const selectedVoice = result.ttsVoice || 'nova'; // Default to 'nova' if not set
                preloadAudio(fullText, selectedVoice, (audio) => {
                    if (audio) {
                        preloadedAudio = audio;
                        currentAudio = null; // Reset currentAudio when new audio is preloaded
                        showToast("New audio is ready with the updated voice.");
                        enableTtsButton(); // Always enable the TTS button after preloading
                        
                        // Update the TTS button event listener
                        if (ttsButton) {
                            ttsButton.addEventListener('click', debounce(function() {
                                if (preloadedAudio && preloadedAudio.paused) {
                                    updateActivity('tts_used');
                                }
                            }, 300));
                        }
                    } else {
                        showToast("Failed to prepare audio with the new voice.");
                        disableTtsButton(); // Disable the button if preloading failsc
                    }
                });
            });
        }
    }
    
    
    // Add these helper functions to manage the TTS button state
    function enableTtsButton() {
        const ttsButton = document.getElementById('ttsButton');
        if (ttsButton) {
            ttsButton.disabled = false;
        }
    }
    
    function disableTtsButton() {
        const ttsButton = document.getElementById('ttsButton');
        if (ttsButton) {
            ttsButton.disabled = true;
        }
    }

    // Add this function to fetch the TTS endpoint URL
    function fetchTtsEndpointUrl() {
        fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_tts_endpoint')
            .then(response => response.json())
            .then(data => {
                ttsEndpointUrl = data.tts_endpoint;
                // ////console.log("TTS endpoint URL:", ttsEndpointUrl);
            })
            .catch(error => {
                console.error('Error fetching TTS endpoint URL:', error);
                // Fallback to the default URL if fetching fails
                ttsEndpointUrl = 'https://summariser-test-f7ab30f38c51.herokuapp.com/tts';
            });
    }

    
    async function sendUserActivity(activityType) {
        try {
            const token = await getValidToken();
            const inputElement = document.getElementById('inputText');
            const modelElement = document.getElementById('modelSelect');
    
            // Check if the input is a URL
            const isUrl = /^https?:\/\//i.test(inputElement.value.trim());
    
            const activityData = {
                model_selected: modelElement.value,
                searched_for: isUrl ? 'url' : 'text',
                searched_data: inputElement.value,
                request_time: Date.now() / 1000, // Convert to seconds
                tts_used: activityType === 'tts_used' ? true : null,
                copied_summary: activityType === 'copied_summary' ? true : null,
                summary_exported: activityType === 'summary_exported' ? true : null
            };
    
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/user_activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(activityData)
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
            }
    
            // ////console.log('User activity sent successfully');
        } catch (error) {
            console.error('Error sending user activity:', error);
        }
    }
    
    function updateActivity(action) {
        const now = Date.now();
        // Prevent multiple entries within 5 seconds for the same action
        if (action !== lastActivityType || now - lastActivityTime > 5000) {
            sendUserActivity(action);
            lastActivityType = action;
            lastActivityTime = now;
        }
    }
    
    document.getElementById('copyButton').addEventListener('click', function() {
        const summaryContainer = document.getElementById('summaryContainer');
        if (summaryContainer) {
            const summaryText = summaryContainer.innerText;
            navigator.clipboard.writeText(summaryText).then(() => {
                showToast("Summary copied to clipboard!");
                updateActivity('copied_summary');
            }).catch(err => {
                console.error('Failed to copy summary: ', err);
                showToast("Failed to copy summary. Please try again.");
            });
        } else {
            console.error('Summary container not found');
            showToast("Error: Summary not available");
        }
    });

    document.getElementById('exportButton').addEventListener('click', function() {
        exportSummary();
        updateActivity('summary_exported');
    });

    async function displayUserInfo() {
        try {
            const userId = await getUserId();
            //console.log("User ID:", userId);
            const token = await getValidToken();
            //console.log("Token received:", token ? "Yes" : "No");
            
            if (!token) {
                throw new Error('Failed to get or create token');
            }
            
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_user_info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            //console.log("User info data:", data);
            
            // Update account creation date
            if (data.created_at) {
                const createdDate = new Date(data.created_at).toLocaleDateString();
                const userInfoElement = document.getElementById('userInfo');
                if (userInfoElement) {
                    userInfoElement.textContent = `Account created on: ${createdDate}`;
                }
            }
            
            // Fetch and update free summaries count
            await fetchAndUpdateFreeSummariesCount();
            
            // Show welcome message for new users
            if (data.new_user) {
                showWelcomeToast("Welcome! You've been granted 10 free summaries.");
            }
        } catch (error) {
            console.error('Error in displayUserInfo:', error);
            showToast(`Error: ${error.message}`);
        }
    }

    // Call this function when the popup opens
    displayUserInfo();

    function exportSummary() {
        const summaryContainer = document.getElementById('summaryContainer');
        const summaryText = summaryContainer.innerText;
        const blob = new Blob([summaryText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'privacy_policy_summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast("Summary exported successfully!");
        updateActivity('export');  // Add this line
    }

    async function getValidToken() {
        let token = await new Promise((resolve) => {
            chrome.storage.local.get(['auth_token'], function(result) {
                resolve(result.auth_token);
            });
        });
    
        async function handleNewToken() {
            const response = await requestNewToken();
            if (response.new_user) {
                showToast("Welcome! You've been granted 10 free summaries.");
                await fetchAndUpdateFreeSummariesCount();
            }
            return response.token;
        }
    
        if (!token) {
            //console.log('No token found, requesting new token');
            return await handleNewToken();
        }
    
        // Check if the token is expired
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp;
            const currentTimestamp = Math.floor(Date.now() / 1000);
            if (currentTimestamp > exp) {
                //console.log('Token expired, requesting new token');
                return await handleNewToken();
            }
        } catch (error) {
            console.error('Error parsing token:', error);
            return await handleNewToken();
        }
    
        return token;
    }
    
    async function getOrCreateUser() {
        try {
            //console.log("Generating fingerprint...");
            const fingerprint = await getFingerprint();
            //console.log("Fingerprint generated:", fingerprint);
            
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/new-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fingerprint })
            });
            const data = await response.json();
            //console.log("Server response:", data);
    
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
    
            return { 
                fingerprint, 
                userId: data.user_id, 
                new_user: data.new_user, 
                summaries_left: data.summaries_left 
            };
        } catch (error) {
            console.error('Error in getOrCreateUser:', error);
            showToast(`Error: ${error.message}`);
            throw error;
        }
    }
    
    async function requestNewToken() {
        try {
            //console.log("Requesting new token...");
            const { userId, fingerprint } = await getOrCreateUser();
            //console.log("User data:", { userId, fingerprint });
    
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_or_create_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId, fingerprint: fingerprint })
            });
    
            //console.log("Token request response status:", response.status);
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
            }
    
            const data = await response.json();
            //console.log("Token response data:", data);
    
            if (!data.token) {
                throw new Error('No token received from server');
            }
    
            const newToken = data.token;
    
            // Store the new token
            chrome.storage.local.set({ auth_token: newToken }, function() {
                //console.log('New token saved to storage');
            });
    
            return { token: newToken, new_user: data.new_user };
        } catch (error) {
            console.error('Error requesting new token:', error);
            showToast(`Error: ${error.message}`);
            return { token: null, new_user: false, error: error.message };
        }
    }

async function getOrCreateUser() {
    try {
        //console.log("Generating fingerprint...");
        const fingerprint = await getFingerprint();
        //console.log("Fingerprint generated:", fingerprint);
        const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/new-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fingerprint })
        });
        const data = await response.json();
        //console.log("Server response:", data);

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return { 
            userId: data.user_id, 
            fingerprint, 
            new_user: data.new_user 
        };
    } catch (error) {
        console.error('Error in getOrCreateUser:', error);
        showToast(`Error: ${error.message}`);
        throw error;
    }
}
    
    function startNewSession(summaryData) {
        currentSessionId = generateSessionId();
        sendInitialActivityLog(summaryData);
    }
    
    async function sendInitialActivityLog(summaryData) {
        const token = await getValidToken();
        const userId = await getUserId();
        const activityData = {
            session_id: currentSessionId,
            user_id: userId,
            model_selected: summaryData.model,
            searched_for: summaryData.isUrl ? 'url' : 'text',
            searched_data: summaryData.input,
            scrape_data: summaryData.scrapeData || null,
            request_time: Date.now() / 1000, // Convert to seconds
            tts_used: false,
            copied_summary: false,
            summary_exported: false
        };
        
        try {
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/user_activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(activityData)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error sending initial activity log:', error);
        }
    }

    function generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async function updateActivity(action) {
        if (!currentSessionId) {
            console.error('No active session');
            return;
        }
        
        const token = await getValidToken();
        const activityData = {
            session_id: currentSessionId,
            [action]: true
        };
        
        try {
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/user_activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(activityData)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // ////console.log(`Activity ${action} updated successfully`);
        } catch (error) {
            console.error('Error updating activity:', error);
        }
    }
    
    // Call this when loading a new summary
    function onSummaryLoaded(summaryData) {
        startNewSession(summaryData);
    }

    // Update event listeners
    document.getElementById('copyButton').addEventListener('click', function() {
        updateActivity('copied_summary');
    });
    document.getElementById('exportButton').addEventListener('click', function() {
        updateActivity('summary_exported');
    });

// Call this when the app is about to close or when starting a new summary
function endSession() {
        currentSessionId = null;
    }
});