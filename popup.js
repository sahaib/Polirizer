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

document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const modelSelect = document.getElementById('modelSelect');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const resultDiv = document.getElementById('resultDiv');
    const loaderContainer = document.getElementById('loaderContainer');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const copyButton = document.getElementById('copyButton');
    const ttsButton = document.getElementById('ttsButton');
    const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
    let lastInput = '';
    let lastModel = '';
    let currentAudio = null;
    let preloadedAudio = null;
    let isPreloading = false;
    let ttsEndpointUrl = 'https://summariser-test-f7ab30f38c51.herokuapp.com/tts'; // Default URL

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
            chrome.storage.local.get(['userId'], function(result) {
                let userId = result.userId;
                if (!userId) {
                    userId = 'user_' + Math.random().toString(36).substr(2, 9);
                    chrome.storage.local.set({userId: userId});
                }
                resolve(userId);
            });
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
            document.getElementById('inputText').style.display = 'none';
            document.getElementById('modelSelect').style.display = 'none';
            summarizeBtn.style.display = 'none';
        }
    }

    function hideLoader() {
        if (loaderContainer) {
            loaderContainer.style.display = 'none';
            // Show other elements™
            document.getElementById('inputText').style.display = 'block';
            document.getElementById('modelSelect').style.display = 'inline-block';
            summarizeBtn.style.display = 'inline-block';
            // resultContainer will be shown by displaySummary or displayError
        }
    }

    function toggleSummarizeButton(disabled) {
        if (summarizeBtn) {
            summarizeBtn.disabled = disabled;
            summarizeBtn.style.opacity = disabled ? '0.5' : '1';
            summarizeBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
    }

    function isInputValid(input) {
        const minLength = 50; // Minimum length for text input
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

        // Check if the input is a valid URL
        if (urlPattern.test(input)) {
            return true; // Always consider URLs as valid input
        }

        // For non-URL input, check the length
        if (input.trim().length < minLength) {
            displayError(`Please enter at least ${minLength} characters or a valid URL.`);
            return false;
        }

        return true;
    }

    // Modify the event listener for the summarize button (around line 179)
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', debounce(async function() {
            const input = inputText.value.trim();
            const model = modelSelect.value;

            if (!input) {
                displayError('Please enter a URL or paste privacy policy text.');
                return;
            }

            // Add this near the beginning of the click event listener, after getting the input
            const maxInputLength = 50000; // Adjust this value as needed
            if (input.length > maxInputLength) {
                displayError(`Input is too long. Please limit your input to ${maxInputLength} characters.`);
                return;
            }

            // Replace lines 190-192 with this improved URL detection logic
            const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
            const urlMatches = input.match(urlRegex);

            if (urlMatches && urlMatches.length > 1) {
                displayError('Please enter only one URL or paste the privacy policy text directly. Multiple URLs are not supported.');
                return;
            }

            if (urlMatches && urlMatches.length === 1) {
                // Single URL detected
                let url = urlMatches[0];
                inputText.value = url; // Update the input field with the detected URL
            } else if (urlMatches && urlMatches.length === 0) {
                // No URL detected, check if the input contains "http" or "https"
                if (input.includes('http://') || input.includes('https://')) {
                    displayError('Invalid URL format. Please enter a valid URL or paste the privacy policy text directly.');
                    return;
                }
            }

            if (!isInputValid(input)) {
                return; // The error message is already displayed by isInputValid
            }

            summarizeBtn.disabled = true;
            showLoader();

            try {
                const freeSummariesLeft = await getFreeSummariesCount();
                let apiKey = null;

                if (freeSummariesLeft > 0) {
                    // Use server-side API key
                    apiKey = 'server_side';
                } else {
                    // Use client-side API key
                    apiKey = await getApiKey(`${model}ApiKey`);
                    if (!apiKey) {
                        throw new Error('No free summaries left and no valid API key provided');
                    }
                }

                const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/summarize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        input: input,
                        model: model,
                        api_key: apiKey,
                        user_id: await getUserId()
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (result.error) {
                    throw new Error(result.error);
                }

                displaySummary(result.summary);
                updateFreeSummariesDisplay(result.free_summaries_left);
            } catch (error) {
                if (error.message.includes('No free summaries left')) {
                    displayError('You have used all your free summaries. Enter your API key(s) to continue.');
                } else {
                    displayError(`Failed to summarize: ${error.message}`);
                }
            } finally {
                summarizeBtn.disabled = false;
                hideLoader();
            }
        }, 300));
    }

    async function scrapeWebsite(url) {
        try {
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.content;
        } catch (error) {
            throw new Error('Failed to scrape website content. Please try pasting the text directly.');
        }
    }

    // Add this function to get the current free summaries count
    async function getFreeSummariesCount() {
        try {
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_free_summaries_count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: await getUserId()
                })
            });
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
    
    function displayError(errorMessage) {
        const resultContainer = document.getElementById('resultContainer');
        const summaryContainer = document.getElementById('summaryContainer');
        const resultDiv = document.getElementById('resultDiv');
        const copyButton = document.getElementById('copyButton');
        const summaryHeader = document.querySelector('.summary-header');
        
        // Hide summary-related elements
        summaryContainer.style.display = 'none';
        copyButton.style.display = 'none';
        summaryHeader.style.display = 'none';
        
        // Clear previous content
        resultDiv.innerHTML = '';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message user-friendly';
        errorDiv.innerHTML = `
            <h3>Oops!</h3>
            <p>${errorMessage}</p>
        `;
        
        resultDiv.appendChild(errorDiv);
        resultContainer.style.display = 'block';

        // Only add the "Open Settings" button if it's the API key error
        if (errorMessage.includes('Enter your API key')) {
            const openSettingsBtn = document.createElement('button');
            openSettingsBtn.id = 'openSettingsBtn';
            openSettingsBtn.className = 'action-button';
            openSettingsBtn.textContent = 'Open Settings';
            openSettingsBtn.addEventListener('click', function() {
                if (settingsModal) {
                    settingsModal.style.display = 'block';
                    loadApiKeysIntoSettingsForm();
                }
            });
            errorDiv.appendChild(openSettingsBtn);
        }
    }


    function updateFreeSummariesDisplay(count) {
        const counterElement = document.getElementById('freeSummariesCounter');
        if (counterElement) {
            const newCount = Math.max(0, count);
            counterElement.textContent = `Free summaries left: ${newCount}`;
            counterElement.style.display = 'block';
        }
    }

    // Add this function to fetch the free summaries count
    async function fetchFreeSummariesCount() {
        try {
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_free_summaries_count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: await getUserId()
                })
            });
            const data = await response.json();
            if (data.free_summaries_left !== undefined) {
                updateFreeSummariesDisplay(data.free_summaries_left);
            } else {
                updateFreeSummariesDisplay(0);
            }
        } catch (error) {
            updateFreeSummariesDisplay(0);
        }
    }

    // Call this function when the popup opens
    fetchFreeSummariesCount();

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

    // Move the copyButton event listener inside the DOMContentLoaded event
    if (copyButton) {
        copyButton.addEventListener('click', function() {
            const summaryContent = document.getElementById('summaryContainer').innerText;
            navigator.clipboard.writeText(summaryContent).then(function() {
                showToast("Summary copied to clipboard!");
            }).catch(function(err) {
                showToast("Failed to copy summary. Please try again.");
            });
        });
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

    // Update the ttsVoiceSelect options to match GPT TTS voices
    // const ttsVoiceOptions = [
    //     { value: 'alloy', text: 'Alloy' },
    //     { value: 'echo', text: 'Echo' },
    //     { value: 'fable', text: 'Fable' },
    //     { value: 'onyx', text: 'Onyx' },
    //     { value: 'nova', text: 'Nova' },
    //     { value: 'shimmer', text: 'Shimmer' }
    // ];

    // // Populate the ttsVoiceSelect dropdown
    // ttsVoiceOptions.forEach(option => {
    //     const optionElement = document.createElement('option');
    //     optionElement.value = option.value;
    //     optionElement.textContent = option.text;
    //     ttsVoiceSelect.appendChild(optionElement);
    // });

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

    // Update the preloadAudioWithCurrentSettings function
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
                    } else {
                        showToast("Failed to prepare audio with the new voice.");
                    }
                });
            });
        }
    }

    // Add this function to fetch the TTS endpoint URL
    function fetchTtsEndpointUrl() {
        fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/get_tts_endpoint')
            .then(response => response.json())
            .then(data => {
                ttsEndpointUrl = data.tts_endpoint;
            })
            .catch(error => {
            });
    }

    // Call this function when the popup loads
    fetchTtsEndpointUrl();
});