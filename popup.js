console.log('popup.js started');
window.onerror = function(message, source, lineno, colno, error) {
    // Error logging can be replaced with a production-ready error tracking solution
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
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
    let lastInput = '';
    let lastModel = '';

    console.log('summarizeBtn:', summarizeBtn);
    console.log('settingsBtn:', settingsBtn);
    console.log('loaderContainer:', loaderContainer);
    console.log('copyButton:', copyButton);

    function debugLog(message) {
        // Debug logging removed for production
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
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return doc.body.innerText;
        } catch (error) {
            throw error;
        }
    }

    async function sendSummarizeRequest(input, model, apiKey) {
        console.log(`Sending summarize request for model: ${model}`);
        console.log(`API Key provided: ${apiKey ? 'Yes' : 'No'}`);
        const userId = await getUserId();
        let requestData = { 
            input, 
            model, 
            user_id: userId
        };

        if (apiKey) {
            requestData.api_key = apiKey;
        }

        console.log('Full request data:', JSON.stringify({...requestData, api_key: apiKey ? `${apiKey.substring(0, 5)}...` : undefined}));
        
        try {
            const response = await fetch('https://summariser-test-f7ab30f38c51.herokuapp.com/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();
            console.log('Server response:', data);

            if (!response.ok) {
                throw new Error(data.error || 'An error occurred while summarizing');
            }

            if (data.free_summaries_left !== undefined) {
                updateFreeSummariesDisplay(data.free_summaries_left);
            }

            return data;
        } catch (error) {
            console.error('Error in sendSummarizeRequest:', error);
            throw error;
        }
    }

    async function getUserId() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['userId'], function(result) {
                let userId = result.userId;
                if (!userId) {
                    userId = 'user_' + Math.random().toString(36).substr(2, 9);
                    chrome.storage.local.set({userId: userId});
                }
                console.log('User ID:', userId);
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
        } else {
            console.error('loaderContainer is null');
        }
    }

    function hideLoader() {
        if (loaderContainer) {
            loaderContainer.style.display = 'none';
            // Show other elements
            document.getElementById('inputText').style.display = 'block';
            document.getElementById('modelSelect').style.display = 'inline-block';
            summarizeBtn.style.display = 'inline-block';
            // resultContainer will be shown by displaySummary or displayError
        } else {
            console.error('loaderContainer is null');
        }
    }

    function toggleSummarizeButton(disabled) {
        if (summarizeBtn) {
            summarizeBtn.disabled = disabled;
            summarizeBtn.style.opacity = disabled ? '0.5' : '1';
            summarizeBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
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

    function isInputValid(input) {
        const minLength = 50; // Adjust this value as needed
        return input.trim().length >= minLength;
    }

    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', async function() {
            if (summarizeBtn.disabled) return;
            
            const input = inputText.value.trim();
            const model = modelSelect.value;

            if (!input) {
                displayError('Please enter a URL or paste privacy policy text.');
                return;
            }

            if (!isInputValid(input)) {
                displayError('The input is too short. Please provide a longer text or a valid URL.');
                return;
            }

            summarizeBtn.disabled = true;
            showLoader();
            
            try {
                let processedInput = input;
                if (input.startsWith('http://') || input.startsWith('https://')) {
                    processedInput = await fetchUrlContent(input);
                }
                
                let apiKey = null;
                if (['mistral-small-latest', 'gpt-4o-mini', 'claude-3-5-sonnet-20240620', 'gemini-1.5-flash-8b'].includes(model)) {
                    apiKey = await getApiKey(`${model}ApiKey`);
                    
                    if (!apiKey) {
                        throw new Error(`API key not found for ${model}. Please set the API key in the settings.`);
                    }
                }

                const result = await sendSummarizeRequest(processedInput, model, apiKey);
                console.log('Summarize request result:', result);
                if (result.summary) {
                    displaySummary(result.summary);
                } else {
                    throw new Error('No summary returned from the server');
                }
            } catch (error) {
                displayError(error.message);
            } finally {
                hideLoader();
                summarizeBtn.disabled = false;
            }
        });
    } else {
        console.error('summarizeBtn is null');
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
            console.log('Settings modal forcibly closed, new display style:', settingsModal.style.display);
        }
    }

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', function() {
            console.log('Settings button clicked');
            settingsModal.style.display = 'block';
            console.log('Settings modal opened, display style:', settingsModal.style.display);
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

            chrome.storage.local.set({
                'gpt-4o-miniApiKey': gpt4oMiniApiKey,
                'claude-3-5-sonnet-20240620ApiKey': claudeApiKey,  // Update this line
                'gemini-1.5-flash-8bApiKey': geminiApiKey,
                'mistral-small-latestApiKey': mistralApiKey
            }, function() {
                console.log('API keys saved');
                closeSettingsModal();
                updateModelSelectOptions();
                showToast("Settings saved successfully!");
            });
        });
    }

    if (settingsModal) {
        window.addEventListener('click', function(event) {
            if (event.target == settingsModal) {
                console.log('Clicked outside settings modal');
                closeSettingsModal();
            }
        });
    }

    if (settingsModal) {
        console.log('Initial settings modal display style:', settingsModal.style.display);
    }

    function formatSummary(summary) {
        // Remove any leading HTML tags
        summary = summary.replace(/^<[^>]+>/, '');

        const sections = summary.split(/\n(?=(?:\d+\.|\*\*)[^*]+\*\*)/);
        let formattedSummary = '<div class="summary-content">';

        sections.forEach((section) => {
            if (section.trim()) {
                const lines = section.split('\n');
                const titleMatch = lines[0].match(/^(?:(\d+\.)\s+)?(\*\*)(.+?)(\*\*)(\s+[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])?/u);
                
                if (titleMatch) {
                    const [, number, , title, , emoji] = titleMatch;
                    formattedSummary += `<h3>${number || ''}${title}${emoji || ''}</h3>`;
                } else if (lines[0].trim()) {
                    // If it's not a matched title but not empty, treat it as a regular paragraph
                    formattedSummary += `<p>${lines[0]}</p>`;
                }

                const content = lines.slice(1).join('\n').trim();
                const points = content.split('\n').filter(point => point.trim());
                
                if (points.length > 0) {
                    formattedSummary += '<ul>';
                    points.forEach(point => {
                        const formattedPoint = point.trim()
                            .replace(/^[-•🔹🔸]\s*/, '') // Remove common bullet point characters
                            .replace(/^\*\*(.+?)\*\*/, '<strong>$1</strong>'); // Convert **text** to <strong>text</strong>
                        formattedSummary += `<li>${formattedPoint}</li>`;
                    });
                    formattedSummary += '</ul>';
                }
            }
        });

        // Add the disclaimer at the end of the summary
        formattedSummary += `
            <div class="disclaimer">
                <h4>Disclaimer:</h4>
                <p>This tool is for informational purposes only. Always read the full privacy policy for complete information.</p>
            </div>
        `;

        formattedSummary += '</div>';
        return formattedSummary;
    }

    function displaySummary(summary) {
        const resultContainer = document.getElementById('resultContainer');
        const summaryContainer = document.getElementById('summaryContainer');
        const resultDiv = document.getElementById('resultDiv');
        const copyButton = document.getElementById('copyButton');
        const summaryHeader = document.querySelector('.summary-header');

        if (summary.trim() === '<div class="summary-content"></div>' || summary.trim() === '') {
            displayError("No summary content received. Please try again.");
            return;
        }

        // Show summary-related elements
        summaryContainer.style.display = 'block';
        copyButton.style.display = 'block';
        summaryHeader.style.display = 'flex';

        const formattedSummary = formatSummary(summary);
        const sanitizedSummary = DOMPurify.sanitize(formattedSummary);
        
        // Split the summary and disclaimer
        const summaryParts = sanitizedSummary.split('<div class="disclaimer">');
        
        summaryContainer.innerHTML = summaryParts[0];
        if (summaryParts.length > 1) {
            resultDiv.innerHTML = '<div class="disclaimer">' + summaryParts[1];
        } else {
            resultDiv.innerHTML = '';
        }
        
        resultContainer.style.display = 'block';
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
                console.error('Server did not return free_summaries_left');
                updateFreeSummariesDisplay(0);
            }
        } catch (error) {
            console.error('Error fetching free summaries count:', error);
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
            const summaryContent = resultDiv.innerText;
            navigator.clipboard.writeText(summaryContent).then(function() {
                showToast("Summary copied to clipboard!");
            }).catch(function(err) {
                console.error('Failed to copy text: ', err);
                showToast("Failed to copy summary. Please try again.");
            });
        });
    } else {
        console.error('copyButton is null');
    }

    // Add this function to handle website scraping
    async function scrapeWebsite(url) {
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
            console.log('API keys loaded into settings form');
        });
    }
});