var AUDIO_FORMATS = {
  ogg_vorbis: 'audio/ogg',
  mp3: 'audio/mpeg',
  pcm: 'audio/wave; codecs=1',
};

/**
 * Handles fetching JSON over HTTP
 */
function fetchJSON(method, url, onSuccess, onError) {
  var request = new XMLHttpRequest();
  request.open(method, url, true);
  request.onload = function () {
    // If loading is complete
    if (request.readyState === 4) {
      // if the request was successful
      if (request.status === 200) {
        var data;

        // Parse the JSON in the response
        try {
          data = JSON.parse(request.responseText);
        } catch (error) {
          onError(request.status, error.toString());
        }

        onSuccess(data);
      } else {
        onError(request.status, request.responseText);
      }
    }
  };

  request.send();
}
/**
 * Returns a list of audio formats supported by the browser
 */
function getSupportedAudioFormats(player) {
  return Object.keys(AUDIO_FORMATS).filter(function (format) {
    var supported = player.canPlayType(AUDIO_FORMATS[format]);
    return supported === 'probably' || supported === 'maybe';
  });
}

function insertTextAtIndex(
  originalText,
  index,
  openTag,
  endIndex,
  closeTag
) {
  if (index < 0 || index > originalText.length) {
    console.log('Index is out of range.');
    return originalText;
  }

  const firstPart = originalText.substring(0, index);
  const secondPart = originalText.substring(index, endIndex);
  const thirdPart = originalText.substring(endIndex);

  const newText = firstPart + openTag + secondPart + closeTag + thirdPart;
  return newText;
}

function enableButton() {
  // Enable the second button (kept for backward compatibility with DetectPIIEntities)
  var submitBtn = document.getElementById('SynthesizeSpeech');
  if (submitBtn) {
    submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('synthesizeForm'),
    voiceMenu = document.getElementById('voice'),
    text = document.getElementById('textInput'),
    player = document.getElementById('player'),
    submit = document.getElementById('SynthesizeSpeech'),
    charCount = document.getElementById('charCount'),
    supportedFormats = getSupportedAudioFormats(player);

  // Function to check if form is valid and enable/disable submit button
  function checkFormValidity() {
    var hasText = text && text.value.trim().length > 0;
    var hasVoice = voiceMenu && voiceMenu.selectedIndex > 0 && voiceMenu.value !== '';
    var hasSupportedFormat = supportedFormats.length > 0;
    
    
    if (hasText && hasVoice && hasSupportedFormat) {
      submit.disabled = false;
    } else {
      submit.disabled = true;
    }
  }

  // Character counter
  if (charCount && text) {
    function updateCharCount() {
      charCount.textContent = text.value.length;
    }
    text.addEventListener('input', function() {
      updateCharCount();
      checkFormValidity();
    });
    updateCharCount(); // Initial count
  }

  if (supportedFormats.length === 0) {
    submit.disabled = true;
    alert(
      'The web browser in use does not support any of the' +
        ' available audio formats. Please try with a different' +
        ' one.'
    );
  }

  // Play the audio stream when the form is submitted successfully
  input.addEventListener('submit', function (event) {
    // Validate the fields in the form, display a message if
    // unexpected values are encountered
    if (voiceMenu.selectedIndex <= 0 || text.value.length === 0) {
      alert('Please fill in all the fields.');
      event.preventDefault();
      return false;
    } else {
      var selectedVoice = voiceMenu.options[voiceMenu.selectedIndex].value;

      // Point the player to the streaming server
      player.src =
        '/read?voiceId=' +
        encodeURIComponent(selectedVoice) +
        '&text=' +
        encodeURIComponent(text.value) +
        '&outputFormat=' +
        supportedFormats[0];
      player.play();
    }
    event.preventDefault();
  });

  // Add event listeners to check form validity
  if (text) {
    text.addEventListener('input', checkFormValidity);
    text.addEventListener('paste', function() {
      setTimeout(checkFormValidity, 10);
    });
  }
  if (voiceMenu) {
    voiceMenu.addEventListener('change', checkFormValidity);
  }
  
  // Initial check after a short delay to ensure DOM is ready
  setTimeout(checkFormValidity, 100);

  // Load the list of available voices and display them in a menu
  fetchJSON(
    'GET',
    '/voices',
    // If the request succeeds
    function (voices) {
      var container = document.createDocumentFragment();

      // Build the list of options for the menu
      voices.forEach(function (voice) {
        var option = document.createElement('option');
        option.value = voice['Id'];
        option.innerHTML =
          voice['Name'] +
          ' (' +
          voice['Gender'] +
          ', ' +
          voice['LanguageName'] +
          ')';
        container.appendChild(option);
      });

      // Add the options to the menu and enable the form field
      voiceMenu.appendChild(container);
      voiceMenu.disabled = false;
      
      // Auto-select first voice if available and text exists
      if (voices.length > 0 && text && text.value.trim().length > 0) {
        voiceMenu.selectedIndex = 1; // Skip the "Choose a voice..." option
      }
      
      // Check form validity after voices are loaded
      setTimeout(checkFormValidity, 50);
    },
    // If the request fails
    function (status, response) {
      // Display a message in case loading data from the server
      // fails - this indicates an issue with AWS credentials
      console.error('Failed to load voices:', status, response);
      
      var errorMessage = 'Error loading voices from AWS';
      
      // Try to parse error response
      try {
        var errorData = JSON.parse(response);
        if (errorData.error) {
          errorMessage = 'AWS Error: ' + errorData.error;
          console.error('AWS Error:', errorData.error);
        }
      } catch (e) {
        errorMessage = 'Error: ' + status + ' - ' + response;
      }
      
      // Show error alert to indicate credential issues
      alert(errorMessage + '\n\nThis likely indicates an issue with AWS credentials.');
      
      // Keep voice menu disabled to show that credentials are not working
      voiceMenu.disabled = true;
    }
  );
  document
    .getElementById('DetectPIIEntities')
    .addEventListener('click', function () {
      const textInput = document.getElementById('textInput').value;
      if (textInput.trim() !== '') {
        fetch('/detect-entities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: textInput }),
        })
          .then((response) => response.json())
          .then((data) => {
            const resultUl = document.getElementById('entityresult');
            resultUl.innerHTML = ''; // Clear previous results

            const openingSSMLTags = `<amazon:effect name="whispered"><prosody rate="500%">`;
            const closingSSMLTags = `</prosody></amazon:effect>`;
            const entities = data.entities;
            var modifiedText = '';
            let count = 0;
            let startIndex = 0;
            let endIndex = 0;
            entities.forEach((entity) => {
              const originalText = document.getElementById('textInput').value;
              if (count != 0) {
                console.log('count=:', count);
                startIndex =
                  parseInt(`${entity.BeginOffset}`, 10) + (53 + 26) * count;
                endIndex =
                  parseInt(`${entity.EndOffset}`, 10) + (53 + 26) * count;
                console.log(startIndex);
              } else {
                startIndex = parseInt(`${entity.BeginOffset}`, 10) + 0;
                endIndex = parseInt(`${entity.EndOffset}`, 10) + 0;
                console.log(startIndex);
              }
              const listItem = document.createElement('li');
              listItem.textContent = `Type: ${entity.Type}, Score: ${entity.Score}`;
              resultUl.appendChild(listItem);
              modifiedText = insertTextAtIndex(
                originalText,
                startIndex,
                openingSSMLTags,
                endIndex,
                closingSSMLTags
              );
              document.getElementById('textInput').value = modifiedText;
              count++;
            });
            document.getElementById('textInput').value =
              `<speak>` +
              document.getElementById('textInput').value +
              `</speak>`;
          })
          .catch((error) => {
            console.error('Error:', error);
          });
      }
    });
});
