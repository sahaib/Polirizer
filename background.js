import { CONFIG } from './config.js';

function checkSavedOptions() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['gptApiKey', 'claude-3-5-sonnet-20240620ApiKey', 'geminiApiKey', 'mistralApiKey'], function(items) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(items);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    const { input, model, apiKey } = request;

    if (!input || !model || !apiKey) {
      sendResponse({error: 'Missing required parameters'});
      return true;
    }

    fetch(CONFIG.SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: input,
        model: model,
        api_key: apiKey
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(text => {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Server returned an invalid response');
      }
    })
    .then(data => {
      if (data.summary) {
        sendResponse({summary: data.summary});
      } else if (data.error) {
        sendResponse({error: data.error});
      } else {
        sendResponse({error: 'Unexpected response format'});
      }
    })
    .catch(error => {
      sendResponse({error: error.toString()});
    });

    return true;  // Will respond asynchronously
  }
});

chrome.runtime.onInstalled.addListener(() => {
  checkSavedOptions();
});

chrome.runtime.onStartup.addListener(() => {
  checkSavedOptions();
});
