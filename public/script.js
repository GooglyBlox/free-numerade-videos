document.getElementById('fetchButton').addEventListener('click', function() {
    const inputUrl = document.getElementById('urlInput').value;
    const videoLinkContainer = document.getElementById('videoLinkContainer');
    
    if (inputUrl.startsWith('https://www.numerade.com/')) {
        videoLinkContainer.innerHTML = '<div class="loader"></div>';

        fetch('/api/getVideoSource', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: inputUrl })
        })
        .then(response => response.json())
        .then(data => {
            if(data.url) {
                videoLinkContainer.innerHTML = `
                    <div>
                        <h3>${data.title}</h3>
                        <a href="${data.url}" target="_blank" class="video-button">Watch video</a>
                        <a href="${data.url}" download class="video-button">Download video</a>
                    </div>`;
            } else {
                videoLinkContainer.innerHTML = 'No video source found.';
            }
        })
        .catch(error => {
            videoLinkContainer.innerHTML = `Error: ${error.message}`;
        });
    } else {
        alert('Please enter a valid Numerade URL');
    }
});