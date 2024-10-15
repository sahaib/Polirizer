// Saves options to chrome.storage
function save_options() {
  var apiKey = document.getElementById('apiKey').value;
  var model = document.getElementById('model').value;
  chrome.storage.sync.set({
    apiKey: apiKey,
    model: model
  }, function() {
    if (chrome.runtime.lastError) {
      console.error('Error saving options:', chrome.runtime.lastError);
    } else {
      console.log('Options saved successfully');
      check_saved_options();
    }
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  chrome.storage.sync.get({
    apiKey: '',
    model: 'gpt'
  }, function(items) {
    document.getElementById('apiKey').value = items.apiKey;
    document.getElementById('model').value = items.model;
    console.log('Options restored');
    check_saved_options();
  });
}

function check_saved_options() {
  chrome.storage.sync.get(['apiKey', 'model'], function(items) {
    console.log('Current saved options:', {
      apiKey: items.apiKey ? 'Set (not shown for security)' : 'Not set',
      model: items.model || 'Not set'
    });
  });
}

// Call this function when the options page loads
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

document.getElementById('checkSaved').addEventListener('click', check_saved_options);